import { wahaSendText, wahaSendSeen, wahaStartTyping, wahaStopTyping } from './waha.js';
import { db } from './db.js';

type SendTextParams = {
    session: string;
    chatId: string;
    text: string;
    skipHumanBehavior?: boolean;
};

// ===== Delay Configuration =====
const SEND_DELAY_MIN_MS = Number(process.env.SEND_DELAY_MIN_MS || 45_000);
const SEND_DELAY_MAX_MS = Number(process.env.SEND_DELAY_MAX_MS || 90_000);

const SEND_COOLDOWN_EVERY = Number(process.env.SEND_COOLDOWN_EVERY || 5);
const SEND_COOLDOWN_MIN_MS = Number(process.env.SEND_COOLDOWN_MIN_MS || 30_000);
const SEND_COOLDOWN_MAX_MS = Number(process.env.SEND_COOLDOWN_MAX_MS || 60_000);

const PROGRESSIVE_DELAY_MULTIPLIER = Number(process.env.PROGRESSIVE_DELAY_MULTIPLIER || 1.08);
const MAX_PROGRESSIVE_MULTIPLIER = Number(process.env.MAX_PROGRESSIVE_MULTIPLIER || 2.0);

const DAILY_LIMIT_PER_SESSION = Number(process.env.DAILY_LIMIT_PER_SESSION || 50);

const READ_DELAY_MIN_MS = Number(process.env.READ_DELAY_MIN_MS || 2_000);
const READ_DELAY_MAX_MS = Number(process.env.READ_DELAY_MAX_MS || 5_000);
const TYPING_DELAY_MIN_MS = Number(process.env.TYPING_DELAY_MIN_MS || 3_000);
const TYPING_DELAY_MAX_MS = Number(process.env.TYPING_DELAY_MAX_MS || 8_000);
const TYPING_MS_PER_CHAR = Number(process.env.TYPING_MS_PER_CHAR || 50);

const ENABLE_HUMAN_BEHAVIOR = process.env.ENABLE_HUMAN_BEHAVIOR !== 'false';

// Single worker for maximum safety
const MAX_CONCURRENT_WORKERS = Number(process.env.SEND_MAX_CONCURRENT_WORKERS || 1);
const workerChains: Promise<void>[] = Array(MAX_CONCURRENT_WORKERS).fill(Promise.resolve());
const workerMetrics: Array<{ lastSentAt: number; sentCount: number }> = Array(MAX_CONCURRENT_WORKERS)
    .fill(null)
    .map(() => ({ lastSentAt: 0, sentCount: 0 }));

let nextWorkerIndex = 0;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNonNegative(n: number) {
    return Math.max(0, n);
}

function randomBetweenMs(minMs: number, maxMs: number) {
    const lo = clampNonNegative(minMs);
    const hi = clampNonNegative(maxMs);
    if (lo >= hi) return lo;
    return lo + Math.floor(Math.random() * (hi - lo));
}

// Apply jitter to avoid predictable patterns (±30%)
function applyJitter(delayMs: number): number {
    const jitterRange = delayMs * 0.3;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(1000, Math.round(delayMs + jitter));
}

// Get progressive multiplier based on session's daily message count
function getProgressiveMultiplier(messageCount: number): number {
    const multiplier = Math.pow(PROGRESSIVE_DELAY_MULTIPLIER, messageCount);
    return Math.min(multiplier, MAX_PROGRESSIVE_MULTIPLIER);
}

// Calculate typing duration based on message length
function calculateTypingDuration(text: string): number {
    const baseTyping = randomBetweenMs(TYPING_DELAY_MIN_MS, TYPING_DELAY_MAX_MS);
    const charTyping = text.length * TYPING_MS_PER_CHAR;
    const totalTyping = baseTyping + charTyping;
    return Math.min(totalTyping, 15_000);
}

// Simulate human reading and typing behavior
async function simulateHumanBehavior(session: string, chatId: string, text: string): Promise<void> {
    if (!ENABLE_HUMAN_BEHAVIOR) return;

    try {
        // 1. Read delay (simulate reading the previous message)
        const readDelay = randomBetweenMs(READ_DELAY_MIN_MS, READ_DELAY_MAX_MS);
        await sleep(readDelay);

        // 2. Send "seen" (blue ticks)
        try {
            await wahaSendSeen(session, chatId);
        } catch (e: any) {
            console.warn(`⚠️ sendSeen failed for ${session}: ${e?.message}`);
        }

        // 3. Brief pause after reading
        await sleep(randomBetweenMs(500, 2000));

        // 4. Start typing indicator
        try {
            await wahaStartTyping(session, chatId);
        } catch (e: any) {
            console.warn(`⚠️ startTyping failed for ${session}: ${e?.message}`);
        }

        // 5. Typing duration based on message length
        const typingDuration = calculateTypingDuration(text);
        await sleep(typingDuration);

        // 6. Stop typing
        try {
            await wahaStopTyping(session, chatId);
        } catch (e: any) {
            console.warn(`⚠️ stopTyping failed for ${session}: ${e?.message}`);
        }
    } catch (e: any) {
        console.warn(`⚠️ Human behavior simulation error for ${session}: ${e?.message}`);
    }
}

// Serialize outgoing WAHA sends with improved delays and human-like behavior.
export function sendTextQueued(params: SendTextParams) {
    const workerIdx = nextWorkerIndex;
    nextWorkerIndex = (nextWorkerIndex + 1) % MAX_CONCURRENT_WORKERS;

    const prev = workerChains[workerIdx];
    const next = prev.then(async () => {
        const metrics = workerMetrics[workerIdx];

        // Check daily limit
        const today = new Date().toISOString().slice(0, 10);
        const stats = db.getDailyStats(params.session, today);
        if (stats && stats.messagesSent >= DAILY_LIMIT_PER_SESSION) {
            console.log(`⚠️ Daily limit reached for ${params.session} (${stats.messagesSent}/${DAILY_LIMIT_PER_SESSION})`);
            return;
        }

        // Get current message count for progressive delay
        const messageCount = stats?.messagesSent || 0;
        const progressiveMultiplier = getProgressiveMultiplier(messageCount);

        // Calculate delay with progressive increase and jitter
        const baseDelay = randomBetweenMs(SEND_DELAY_MIN_MS, SEND_DELAY_MAX_MS);
        const progressiveDelay = Math.round(baseDelay * progressiveMultiplier);
        const finalDelay = applyJitter(progressiveDelay);

        // Cooldown after every N messages
        const isCooldownPoint = metrics.sentCount > 0 && metrics.sentCount % SEND_COOLDOWN_EVERY === 0;
        if (isCooldownPoint) {
            const cooldown = randomBetweenMs(SEND_COOLDOWN_MIN_MS, SEND_COOLDOWN_MAX_MS);
            console.log(`🧊 Cooldown for worker ${workerIdx}: ${Math.round(cooldown / 1000)}s after ${metrics.sentCount} msgs`);
            await sleep(cooldown);
        }

        // Wait for the delay
        await sleep(finalDelay);

        // Simulate human behavior (read receipt, typing, etc.)
        if (!params.skipHumanBehavior) {
            await simulateHumanBehavior(params.session, params.chatId, params.text);
        }

        // Send the message
        console.log(`📤 [W${workerIdx}] Sending from ${params.session} → ${params.chatId.substring(0, 12)}... (msg #${messageCount + 1}, delay ${Math.round(finalDelay / 1000)}s)`);
        await wahaSendText({ session: params.session, chatId: params.chatId, text: params.text });

        // Update metrics
        metrics.lastSentAt = Date.now();
        metrics.sentCount += 1;

        // Update daily stats
        db.incrementDailyStats(params.session, today);
    });

    workerChains[workerIdx] = next.catch((err) => {
        console.error(`❌ sendTextQueued error (${params.session}): ${err?.message || err}`);
    });

    return next;
}

// Get current status of send queue
export function getSendQueueStatus() {
    return {
        maxConcurrentWorkers: MAX_CONCURRENT_WORKERS,
        workers: workerMetrics.map((m, i) => ({
            index: i,
            lastSentAt: m.lastSentAt > 0 ? new Date(m.lastSentAt).toISOString() : null,
            sentCount: m.sentCount,
        })),
        config: {
            delayMin: SEND_DELAY_MIN_MS,
            delayMax: SEND_DELAY_MAX_MS,
            cooldownEvery: SEND_COOLDOWN_EVERY,
            cooldownMin: SEND_COOLDOWN_MIN_MS,
            cooldownMax: SEND_COOLDOWN_MAX_MS,
            dailyLimit: DAILY_LIMIT_PER_SESSION,
            humanBehavior: ENABLE_HUMAN_BEHAVIOR,
        },
    };
}
