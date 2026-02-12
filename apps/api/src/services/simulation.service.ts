import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { SIM15_PRESET } from '../presets/sim15Preset.js';
import { getRandomStartLine, pickReplyFromScript } from '../script.js';
import { sendTextQueued } from '../sendQueue.js';
import { getSessionToChatIdMap } from './waha.service.js';

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export async function runSim15Simulation(config: any) {
    const tz = String(config.timezone || SIM15_PRESET.automationDefaults.timezone);
    const now = DateTime.now().setZone(tz);
    if (!now.isValid) throw new Error('Invalid timezone');

    const windowStart = String(config.windowStart || SIM15_PRESET.automationDefaults.windowStart);
    const windowEnd = String(config.windowEnd || SIM15_PRESET.automationDefaults.windowEnd);
    const messagesPerSession = Number(config.messagesPerSession ?? process.env.SIM15_MESSAGES_PER_SESSION ?? SIM15_PRESET.automationDefaults.messagesPerSession);
    const dailyLimit = Number(config.dailyLimitPerSession ?? process.env.DAILY_LIMIT_PER_SESSION ?? SIM15_PRESET.automationDefaults.dailyLimitPerSession);

    const [sh, sm] = windowStart.split(':').map((n) => Number(n));
    const [eh, em] = windowEnd.split(':').map((n) => Number(n));

    // Get connected sessions
    const sessionToChatIdMap = await getSessionToChatIdMap();
    const connectedSessionNames = Object.keys(sessionToChatIdMap);

    // Gather sessions that are connected and have scripts
    const allSessions = db
        .listSessions()
        .filter((s) => connectedSessionNames.includes(s.wahaSession))
        .filter((s) => (s.autoReplyScriptText || '').trim().length > 0)
        .sort((a, b) => a.wahaSession.localeCompare(b.wahaSession));

    if (allSessions.length < 2) {
        throw new Error(`Minimal 2 session harus terhubung. Saat ini: ${allSessions.length}`);
    }

    // Build session chatId map
    const sessionChatIds: Record<string, string> = {};
    for (const s of allSessions) {
        const chatId = sessionToChatIdMap[s.wahaSession];
        if (chatId) sessionChatIds[s.wahaSession] = chatId;
    }

    const readySessions = allSessions.filter((s) => sessionChatIds[s.wahaSession]);
    if (readySessions.length < 2) {
        throw new Error(`Minimal 2 session harus punya chatId. Ready: ${readySessions.length}`);
    }

    console.log(`🚀 Starting SIM15 simulation with ${readySessions.length} sessions, ${messagesPerSession} msgs/session`);

    // Create simulation record
    const simulationId = randomUUID();
    const simulationName = String(config.name || `sim15-${new Date().toISOString().slice(0, 10)}`);
    const startDate = now.toISODate()!;

    const simulation = db.upsertSimulation({
        id: simulationId,
        name: simulationName,
        active: true,
        timezone: tz,
        windowStart,
        windowEnd,
        messagesPerSession,
        dailyLimitPerSession: dailyLimit,
        sessionNames: readySessions.map((s) => s.wahaSession),
        startDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    // Build tasks in background
    (async () => {
        try {
            // Suppress auto-replies during simulation
            db.setSuppressAutoReplyUntil(DateTime.now().plus({ days: 7 }).toUTC().toISO()!);

            const sessionNames = readySessions.map((s) => s.wahaSession);

            // Create ALL possible send slots
            const sendSlots: Array<{ sender: string; receiver: string }> = [];
            const receiveCounts: Record<string, number> = {};
            for (const name of sessionNames) receiveCounts[name] = 0;

            for (const senderName of sessionNames) {
                const otherSessions = sessionNames.filter((name) => name !== senderName);

                for (let msgIdx = 0; msgIdx < messagesPerSession; msgIdx++) {
                    otherSessions.sort((a, b) => (receiveCounts[a] || 0) - (receiveCounts[b] || 0));
                    const candidates = otherSessions.slice(0, Math.min(3, otherSessions.length));
                    const receiver = candidates[Math.floor(Math.random() * candidates.length)];

                    sendSlots.push({ sender: senderName, receiver });
                    receiveCounts[receiver] = (receiveCounts[receiver] || 0) + 1;
                }
            }

            console.log(`📊 Total send slots: ${sendSlots.length}`);
            console.log(`📊 Receive distribution:`, receiveCounts);

            const shuffledSlots = shuffleArray(sendSlots);

            // Additional shuffle pass
            for (let pass = 0; pass < 3; pass++) {
                for (let i = 1; i < shuffledSlots.length; i++) {
                    if (shuffledSlots[i].sender === shuffledSlots[i - 1].sender) {
                        const swapIdx = i + 1 + Math.floor(Math.random() * Math.max(1, shuffledSlots.length - i - 1));
                        if (swapIdx < shuffledSlots.length) {
                            [shuffledSlots[i], shuffledSlots[swapIdx]] = [shuffledSlots[swapIdx], shuffledSlots[i]];
                        }
                    }
                }
            }

            // Schedule tasks with delays
            const windowStartMinutes = sh * 60 + sm;
            const windowEndMinutes = eh * 60 + em;
            const windowMinutesPerDay = windowEndMinutes >= windowStartMinutes
                ? windowEndMinutes - windowStartMinutes
                : (24 * 60 - windowStartMinutes) + windowEndMinutes;

            function normalizeToWindow(dt: DateTime): DateTime {
                let t = dt.setZone(tz);
                let start = t.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
                let end = t.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
                if (end <= start) {
                    if (t < start) start = start.minus({ days: 1 });
                    end = start.plus({ minutes: windowMinutesPerDay });
                }
                if (t < start) return start;
                if (t >= end) return start.plus({ days: 1 });
                return t;
            }

            const totalTasks = shuffledSlots.length * 2;
            const totalWindowSeconds = Math.max(1, windowMinutesPerDay * 60);
            const delayBetweenTasksSeconds = Math.max(
                1,
                Math.floor((totalWindowSeconds / Math.max(1, totalTasks)) * 0.85)
            );

            console.log(`📅 Schedule: ${totalTasks} tasks, delay ~${Math.round(delayBetweenTasksSeconds / 60)} min/task, window ${windowStart}-${windowEnd}`);

            const tasks: any[] = [];
            const initialDelaySeconds = 14 + Math.floor(Math.random() * 7);
            let taskTime = normalizeToWindow(now.plus({ seconds: initialDelaySeconds }));

            const sessionRandomStartLines: Record<string, number> = {};
            for (const session of readySessions) {
                const randomStart = getRandomStartLine(session.autoReplyScriptText || '', 'all');
                sessionRandomStartLines[session.wahaSession] = randomStart;
                console.log(`   🎲 ${session.wahaSession} random start: line ${randomStart + 1}`);
            }

            const campaignResults: Array<{ chatId: string; fromSession: string; ok: boolean; error?: string }> = [];

            const firstSlot = shuffledSlots[0];
            if (firstSlot) {
                try {
                    const senderSession = readySessions.find((s) => s.wahaSession === firstSlot.sender)!;
                    const receiverChatId = sessionChatIds[firstSlot.receiver];
                    const startLine = sessionRandomStartLines[firstSlot.sender] || 0;
                    const picked = pickReplyFromScript(senderSession.autoReplyScriptText || '', 0, startLine, 'all');

                    if (picked && receiverChatId) {
                        await sendTextQueued({ session: firstSlot.sender, chatId: receiverChatId, text: picked.text });
                        db.setChatProgress(firstSlot.sender, receiverChatId, {
                            seasonIndex: picked.nextSeasonIndex,
                            lineIndex: picked.nextLineIndex,
                            messageCount: 1,
                            lastMessageAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        });
                        db.incrementSentCounter(firstSlot.sender, simulationId);
                        db.incrementReceivedCounter(firstSlot.receiver, simulationId);
                        campaignResults.push({ chatId: receiverChatId, fromSession: firstSlot.sender, ok: true });
                    }
                } catch (e: any) {
                    campaignResults.push({ chatId: sessionChatIds[firstSlot.receiver] || '', fromSession: firstSlot.sender, ok: false, error: e?.message });
                }
            }

            for (let slotIdx = 1; slotIdx < shuffledSlots.length; slotIdx++) {
                const slot = shuffledSlots[slotIdx];
                const receiverChatId = sessionChatIds[slot.receiver];
                const senderChatId = sessionChatIds[slot.sender];

                if (!receiverChatId || !senderChatId) continue;

                taskTime = normalizeToWindow(taskTime);
                tasks.push({
                    id: randomUUID(),
                    simulationId,
                    dueAt: taskTime.toUTC().toISO()!,
                    chatId: receiverChatId,
                    senderSession: slot.sender,
                    kind: 'script-next',
                    status: 'pending',
                    roundIndex: slotIdx,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                taskTime = taskTime.plus({ seconds: delayBetweenTasksSeconds });

                taskTime = normalizeToWindow(taskTime);
                tasks.push({
                    id: randomUUID(),
                    simulationId,
                    dueAt: taskTime.toUTC().toISO()!,
                    chatId: senderChatId,
                    senderSession: slot.receiver,
                    kind: 'script-next',
                    status: 'pending',
                    roundIndex: slotIdx,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                taskTime = taskTime.plus({ seconds: delayBetweenTasksSeconds });
            }

            if (firstSlot) {
                const senderChatId = sessionChatIds[firstSlot.sender];
                if (senderChatId) {
                    taskTime = normalizeToWindow(taskTime.minus({ seconds: (shuffledSlots.length - 1) * delayBetweenTasksSeconds * 2 - delayBetweenTasksSeconds }));
                    tasks.unshift({
                        id: randomUUID(),
                        simulationId,
                        dueAt: normalizeToWindow(now.plus({ seconds: initialDelaySeconds + delayBetweenTasksSeconds })).toUTC().toISO()!,
                        chatId: senderChatId,
                        senderSession: firstSlot.receiver,
                        kind: 'script-next',
                        status: 'pending',
                        roundIndex: 0,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

            tasks.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));

            console.log(`✅ Total scheduled tasks: ${tasks.length}`);

            for (let i = 0; i < Math.min(3, tasks.length); i++) {
                const task = tasks[i];
                const dueTime = DateTime.fromISO(String(task.dueAt), { zone: 'utc' }).setZone(tz);
                console.log(`   ${i + 1}. ${dueTime.toLocaleString(DateTime.DATETIME_SHORT)} - ${task.senderSession} → ${task.chatId.substring(0, 12)}...`);
            }

            db.replaceScheduledTasksForSimulation(simulationId, tasks);

            let maxDueAt: string | null = null;
            for (const t of tasks) {
                if (!maxDueAt || String(t.dueAt) > maxDueAt) maxDueAt = String(t.dueAt);
            }
            if (maxDueAt) {
                const until = DateTime.fromISO(maxDueAt, { zone: 'utc' }).plus({ hours: 1 }).toUTC().toISO()!;
                db.setSuppressAutoReplyUntil(until);
            } else {
                db.setSuppressAutoReplyUntil(null);
            }

            console.log(`🎉 Simulation ${simulationId} fully initialized.`);
        } catch (error: any) {
            console.error(`❌ Simulation ${simulationId} initialization failed:`, error);
            db.upsertSimulation({
                ...simulation,
                active: false,
                updatedAt: new Date().toISOString(),
            });
        }
    })();

    return {
        ok: true,
        simulation,
        status: 'starting',
        message: `Simulasi dimulai dengan ${readySessions.length} nomor. Setiap nomor mengirim ${messagesPerSession} pesan.`,
        sessions: readySessions.length,
        messagesPerSession,
        dailyLimit,
    };
}
