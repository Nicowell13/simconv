import { db } from './db.js';
import { pickReplyFromScript } from './script.js';
import { sendTextQueued } from './sendQueue.js';

let started = false;

type SchedulerOptions = {
    pollIntervalMs?: number;
    batchSize?: number;
};

export function startScheduler(options: SchedulerOptions = {}) {
    if (started) return;
    started = true;

    const pollIntervalMs = options.pollIntervalMs ?? 15_000;
    const batchSize = options.batchSize ?? 10;

    let running = false;

    setInterval(async () => {
        if (running) return;
        running = true;
        const nowIso = new Date().toISOString();
        const due = db.listDueScheduledTasks(nowIso, batchSize);
        if (due.length === 0) {
            running = false;
            return;
        }

        console.log(`⚙️  Scheduler: ${due.length} tasks due, executing...`);

        try {
            for (const task of due) {
                try {
                    const simulation = db.getSimulationById(task.simulationId);
                    if (!simulation?.active) {
                        db.markScheduledTask(task.id, 'sent');
                        continue;
                    }

                    if (!task.senderSession) {
                        db.markScheduledTask(task.id, 'error', 'No sender session specified');
                        continue;
                    }

                    const chosen = db.getSessionByName(task.senderSession);
                    if (!chosen || (chosen.autoReplyScriptText || '').trim().length === 0) {
                        db.markScheduledTask(task.id, 'error', `Sender session not found or no script: ${task.senderSession}`);
                        continue;
                    }

                    // Check quota before sending
                    const messagesPerSession = simulation.messagesPerSession || 10;
                    const dailyLimit = simulation.dailyLimitPerSession || 50;

                    if (!db.canSendMessage(task.senderSession, task.simulationId, messagesPerSession, dailyLimit)) {
                        console.log(`⚠️ Quota reached for ${task.senderSession}, skipping task`);
                        db.markScheduledTask(task.id, 'sent'); // Mark as sent to not retry
                        continue;
                    }

                    // Use 'all' parity since we don't have OLD/NEW distinction
                    const parity = chosen.scriptLineParity || 'all';

                    const progress = db.getChatProgress(chosen.wahaSession, task.chatId) || {
                        seasonIndex: 0,
                        lineIndex: 0,
                        messageCount: 0,
                        updatedAt: new Date().toISOString(),
                    };

                    const picked = pickReplyFromScript(
                        chosen.autoReplyScriptText || '',
                        progress.seasonIndex,
                        progress.lineIndex,
                        parity
                    );

                    if (!picked) {
                        db.markScheduledTask(task.id, 'sent');
                        continue;
                    }

                    console.log(`   📤 ${chosen.wahaSession} → ${task.chatId.substring(0, 12)}...`);
                    await sendTextQueued({ session: chosen.wahaSession, chatId: task.chatId, text: picked.text });

                    // Update progress
                    const newMessageCount = (progress.messageCount || 0) + 1;
                    db.setChatProgress(chosen.wahaSession, task.chatId, {
                        seasonIndex: picked.nextSeasonIndex,
                        lineIndex: picked.nextLineIndex,
                        messageCount: newMessageCount,
                        lastMessageAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });

                    // Update message counters
                    db.incrementSentCounter(task.senderSession, task.simulationId);

                    // Find receiver session from chatId and increment their received counter
                    // The chatId format is like 628xxx@c.us — we need to find which session owns this chatId
                    // This is tracked during simulation setup via sessionToChatIdMap

                    db.markScheduledTask(task.id, 'sent');
                } catch (e: any) {
                    db.markScheduledTask(task.id, 'error', e?.message || 'unknown');
                }
            }
        } finally {
            running = false;
        }
    }, pollIntervalMs);
}
