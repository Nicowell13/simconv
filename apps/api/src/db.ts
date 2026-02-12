import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// ===== Types (kept same) =====

export type SessionRecord = {
    id: string;
    wahaSession: string;
    autoReplyEnabled: boolean;
    autoReplyMode?: 'static' | 'script';
    scriptLineParity?: 'odd' | 'even' | 'all';
    autoReplyText: string;
    autoReplyScriptText?: string;
    createdAt: string;
    updatedAt: string;
};

export type ChatProgress = {
    seasonIndex: number;
    lineIndex: number;
    lastInboundMessageId?: string;
    messageCount?: number;
    lastMessageAt?: string;
    updatedAt: string;
};

export type SimulationRecord = {
    id: string;
    name: string;
    active: boolean;
    timezone: string;
    windowStart: string;
    windowEnd: string;
    messagesPerSession: number;
    dailyLimitPerSession: number;
    sessionNames: string[];
    startDate: string;
    createdAt: string;
    updatedAt: string;
};

export type ScheduledTask = {
    id: string;
    simulationId: string;
    dueAt: string;
    chatId: string;
    kind: 'script-next';
    status: 'pending' | 'sent' | 'error';
    lastError?: string;
    updatedAt: string;
    createdAt: string;
    senderSession?: string;
    roundIndex?: number;
    retryCount?: number;
};

export type SimulationProgressSummary = {
    simulationId: string;
    total: number;
    pending: number;
    sent: number;
    error: number;
    nextDueAt: string | null;
    recentErrors: Array<{
        dueAt: string;
        senderSession?: string;
        chatId: string;
        lastError?: string;
    }>;
};

export type DailySessionStats = {
    sessionName: string;
    date: string;
    messagesSent: number;
    lastMessageAt: string;
};

export type SessionMessageCounter = {
    sessionName: string;
    simulationId: string;
    sent: number;
    received: number;
};

// ===== Database Init =====

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDbFilePath(): string {
    const envPath = process.env.DATA_DIR || process.env.DATABASE_URL;
    if (envPath) {
        const cleaned = envPath.replace(/^file:/, '');
        if (cleaned.endsWith('.db') || cleaned.endsWith('.sqlite')) return cleaned;
        return path.join(cleaned, 'sim.sqlite');
    }
    return path.resolve(__dirname, '..', '..', 'data', 'sim.sqlite');
}

const DB_FILE = getDbFilePath();
const dbDir = path.dirname(DB_FILE);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sql = new Database(DB_FILE);
sql.pragma('journal_mode = WAL');

// Initialize Schema
sql.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        wahaSession TEXT UNIQUE NOT NULL,
        autoReplyEnabled INTEGER DEFAULT 1,
        autoReplyMode TEXT,
        scriptLineParity TEXT,
        autoReplyText TEXT,
        autoReplyScriptText TEXT,
        createdAt TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_progress (
        wahaSession TEXT,
        chatId TEXT,
        seasonIndex INTEGER,
        lineIndex INTEGER,
        lastInboundMessageId TEXT,
        messageCount INTEGER,
        lastMessageAt TEXT,
        updatedAt TEXT,
        PRIMARY KEY (wahaSession, chatId)
    );

    CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        name TEXT,
        active INTEGER DEFAULT 1,
        timezone TEXT,
        windowStart TEXT,
        windowEnd TEXT,
        messagesPerSession INTEGER,
        dailyLimitPerSession INTEGER,
        sessionNames TEXT, -- JSON array
        startDate TEXT,
        createdAt TEXT,
        updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        simulationId TEXT,
        dueAt TEXT,
        chatId TEXT,
        kind TEXT,
        status TEXT,
        lastError TEXT,
        updatedAt TEXT,
        createdAt TEXT,
        senderSession TEXT,
        roundIndex INTEGER,
        retryCount INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_simulationId ON scheduled_tasks(simulationId);
    CREATE INDEX IF NOT EXISTS idx_tasks_dueAt ON scheduled_tasks(dueAt);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON scheduled_tasks(status);

    CREATE TABLE IF NOT EXISTS daily_stats (
        sessionName TEXT,
        date TEXT,
        messagesSent INTEGER DEFAULT 0,
        lastMessageAt TEXT,
        PRIMARY KEY (sessionName, date)
    );

    CREATE TABLE IF NOT EXISTS message_counters (
        sessionName TEXT,
        simulationId TEXT,
        sent INTEGER DEFAULT 0,
        received INTEGER DEFAULT 0,
        PRIMARY KEY (sessionName, simulationId)
    );
`);

// ===== DB Accessors =====

export const db = {
    // ===== Suppress Auto Reply =====
    getSuppressAutoReplyUntil(): string | null {
        const row = sql.prepare('SELECT value FROM kv_store WHERE key = ?').get('suppressAutoReplyUntil') as { value: string } | undefined;
        return row ? row.value : null;
    },

    setSuppressAutoReplyUntil(valueIsoOrNull: string | null): void {
        if (valueIsoOrNull === null) {
            sql.prepare('DELETE FROM kv_store WHERE key = ?').run('suppressAutoReplyUntil');
        } else {
            sql.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run('suppressAutoReplyUntil', valueIsoOrNull);
        }
    },

    // ===== Sessions =====
    listSessions(): SessionRecord[] {
        const rows = sql.prepare('SELECT * FROM sessions').all() as any[];
        return rows.map(r => ({
            ...r,
            autoReplyEnabled: Boolean(r.autoReplyEnabled)
        }));
    },

    getSessionById(id: string): SessionRecord | undefined {
        const row = sql.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as any;
        if (!row) return undefined;
        return { ...row, autoReplyEnabled: Boolean(row.autoReplyEnabled) };
    },

    getSessionByName(wahaSession: string): SessionRecord | undefined {
        const row = sql.prepare('SELECT * FROM sessions WHERE wahaSession = ?').get(wahaSession) as any;
        if (!row) return undefined;
        return { ...row, autoReplyEnabled: Boolean(row.autoReplyEnabled) };
    },

    upsertSession(session: SessionRecord): SessionRecord {
        const now = new Date().toISOString();
        const existing = this.getSessionById(session.id);
        const createdAt = existing ? existing.createdAt : (session.createdAt || now);

        sql.prepare(`
            INSERT OR REPLACE INTO sessions (
                id, wahaSession, autoReplyEnabled, autoReplyMode, scriptLineParity, 
                autoReplyText, autoReplyScriptText, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            session.id,
            session.wahaSession,
            session.autoReplyEnabled ? 1 : 0,
            session.autoReplyMode,
            session.scriptLineParity,
            session.autoReplyText,
            session.autoReplyScriptText,
            createdAt,
            now
        );

        return this.getSessionById(session.id)!;
    },

    deleteSession(id: string): boolean {
        const res = sql.prepare('DELETE FROM sessions WHERE id = ?').run(id);
        return res.changes > 0;
    },

    // ===== Chat Progress =====
    getChatProgress(wahaSession: string, chatId: string): ChatProgress | undefined {
        const row = sql.prepare('SELECT * FROM chat_progress WHERE wahaSession = ? AND chatId = ?').get(wahaSession, chatId) as any;
        if (!row) return undefined;
        // remove composite key fields from return if needed, but keeping them is fine
        return {
            seasonIndex: row.seasonIndex,
            lineIndex: row.lineIndex,
            lastInboundMessageId: row.lastInboundMessageId,
            messageCount: row.messageCount,
            lastMessageAt: row.lastMessageAt,
            updatedAt: row.updatedAt
        };
    },

    setChatProgress(wahaSession: string, chatId: string, progress: ChatProgress): ChatProgress {
        sql.prepare(`
            INSERT OR REPLACE INTO chat_progress (
                wahaSession, chatId, seasonIndex, lineIndex, lastInboundMessageId, 
                messageCount, lastMessageAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            wahaSession,
            chatId,
            progress.seasonIndex,
            progress.lineIndex,
            progress.lastInboundMessageId,
            progress.messageCount,
            progress.lastMessageAt,
            progress.updatedAt
        );
        return progress;
    },

    // ===== Simulations =====
    listSimulations(): SimulationRecord[] {
        const rows = sql.prepare('SELECT * FROM simulations').all() as any[];
        return rows.map(r => ({
            ...r,
            active: Boolean(r.active),
            sessionNames: JSON.parse(r.sessionNames || '[]')
        }));
    },

    getSimulationById(id: string): SimulationRecord | undefined {
        const row = sql.prepare('SELECT * FROM simulations WHERE id = ?').get(id) as any;
        if (!row) return undefined;
        return {
            ...row,
            active: Boolean(row.active),
            sessionNames: JSON.parse(row.sessionNames || '[]')
        };
    },

    upsertSimulation(sim: SimulationRecord): SimulationRecord {
        const now = new Date().toISOString();
        const existing = this.getSimulationById(sim.id);
        const createdAt = existing ? existing.createdAt : (sim.createdAt || now);

        sql.prepare(`
            INSERT OR REPLACE INTO simulations (
                id, name, active, timezone, windowStart, windowEnd, 
                messagesPerSession, dailyLimitPerSession, sessionNames, 
                startDate, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            sim.id,
            sim.name,
            sim.active ? 1 : 0,
            sim.timezone,
            sim.windowStart,
            sim.windowEnd,
            sim.messagesPerSession,
            sim.dailyLimitPerSession,
            JSON.stringify(sim.sessionNames),
            sim.startDate,
            createdAt,
            now
        );
        return this.getSimulationById(sim.id)!;
    },

    // ===== Scheduled Tasks =====
    replaceScheduledTasksForSimulation(simulationId: string, tasks: ScheduledTask[]): void {
        const deleteStmt = sql.prepare('DELETE FROM scheduled_tasks WHERE simulationId = ?');
        const insertStmt = sql.prepare(`
            INSERT INTO scheduled_tasks (
                id, simulationId, dueAt, chatId, kind, status, lastError, 
                updatedAt, createdAt, senderSession, roundIndex, retryCount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = sql.transaction((tasksToInsert: ScheduledTask[]) => {
            deleteStmt.run(simulationId);
            for (const t of tasksToInsert) {
                insertStmt.run(
                    t.id,
                    t.simulationId,
                    t.dueAt,
                    t.chatId,
                    t.kind,
                    t.status,
                    t.lastError,
                    t.updatedAt,
                    t.createdAt,
                    t.senderSession,
                    t.roundIndex,
                    t.retryCount
                );
            }
        });

        transaction(tasks);
    },

    listDueScheduledTasks(nowIso: string, limit = 10): ScheduledTask[] {
        const rows = sql.prepare(`
            SELECT * FROM scheduled_tasks 
            WHERE status = 'pending' AND dueAt <= ? 
            ORDER BY dueAt ASC 
            LIMIT ?
        `).all(nowIso, limit) as ScheduledTask[];
        return rows;
    },

    markScheduledTask(id: string, status: 'sent' | 'error', lastError?: string): void {
        const now = new Date().toISOString();
        sql.prepare(`
            UPDATE scheduled_tasks 
            SET status = ?, lastError = ?, updatedAt = ? 
            WHERE id = ?
        `).run(status, lastError || null, now, id);
    },

    cancelPendingTasksForSimulation(simulationId: string): number {
        const now = new Date().toISOString();
        const res = sql.prepare(`
            UPDATE scheduled_tasks 
            SET status = 'error', lastError = 'Cancelled by user', updatedAt = ?
            WHERE simulationId = ? AND status = 'pending'
        `).run(now, simulationId);
        return res.changes;
    },

    getSimulationProgressSummary(simulationId: string): SimulationProgressSummary | null {
        // Run multiple queries or one complex one. Separate is clearer.
        const total = sql.prepare('SELECT COUNT(*) as c FROM scheduled_tasks WHERE simulationId = ?').get(simulationId) as any;
        if (total.c === 0) return null;

        const pending = sql.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE simulationId = ? AND status = 'pending'").get(simulationId) as any;
        const sent = sql.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE simulationId = ? AND status = 'sent'").get(simulationId) as any;
        const error = sql.prepare("SELECT COUNT(*) as c FROM scheduled_tasks WHERE simulationId = ? AND status = 'error'").get(simulationId) as any;

        const nextDue = sql.prepare("SELECT dueAt FROM scheduled_tasks WHERE simulationId = ? AND status = 'pending' ORDER BY dueAt ASC LIMIT 1").get(simulationId) as any;

        const recentErrorsRows = sql.prepare(`
            SELECT * FROM scheduled_tasks 
            WHERE simulationId = ? AND status = 'error' AND (lastError IS NULL OR lastError != 'Cancelled by user')
            ORDER BY updatedAt DESC 
            LIMIT 5
        `).all(simulationId) as ScheduledTask[];

        const recentErrors = recentErrorsRows.map(t => ({
            dueAt: t.dueAt,
            senderSession: t.senderSession,
            chatId: t.chatId,
            lastError: t.lastError
        }));

        return {
            simulationId,
            total: total.c,
            pending: pending.c,
            sent: sent.c,
            error: error.c,
            nextDueAt: nextDue ? nextDue.dueAt : null,
            recentErrors
        };
    },

    // ===== Daily Stats =====
    getDailyStats(sessionName: string, date: string): DailySessionStats | null {
        const row = sql.prepare('SELECT * FROM daily_stats WHERE sessionName = ? AND date = ?').get(sessionName, date) as any;
        return row || null;
    },

    incrementDailyStats(sessionName: string, date: string): void {
        const now = new Date().toISOString();
        sql.prepare(`
            INSERT INTO daily_stats (sessionName, date, messagesSent, lastMessageAt)
            VALUES (?, ?, 1, ?)
            ON CONFLICT(sessionName, date) DO UPDATE SET
            messagesSent = messagesSent + 1,
            lastMessageAt = excluded.lastMessageAt
        `).run(sessionName, date, now);
    },

    // ===== Message Counters (per simulation) =====
    getMessageCounter(sessionName: string, simulationId: string): SessionMessageCounter | null {
        const row = sql.prepare('SELECT * FROM message_counters WHERE sessionName = ? AND simulationId = ?').get(sessionName, simulationId) as any;
        return row || null;
    },

    incrementSentCounter(sessionName: string, simulationId: string): void {
        sql.prepare(`
            INSERT INTO message_counters (sessionName, simulationId, sent, received)
            VALUES (?, ?, 1, 0)
            ON CONFLICT(sessionName, simulationId) DO UPDATE SET
            sent = sent + 1
        `).run(sessionName, simulationId);
    },

    incrementReceivedCounter(sessionName: string, simulationId: string): void {
        sql.prepare(`
            INSERT INTO message_counters (sessionName, simulationId, sent, received)
            VALUES (?, ?, 0, 1)
            ON CONFLICT(sessionName, simulationId) DO UPDATE SET
            received = received + 1
        `).run(sessionName, simulationId);
    },

    getAllMessageCounters(simulationId: string): SessionMessageCounter[] {
        return sql.prepare('SELECT * FROM message_counters WHERE simulationId = ?').all(simulationId) as SessionMessageCounter[];
    },

    // logic helpers reused as-is but calling new methods
    canSendMessage(sessionName: string, simulationId: string, messagesPerSession: number, dailyLimit: number): boolean {
        const counter = this.getMessageCounter(sessionName, simulationId);
        const sent = counter?.sent || 0;
        const received = counter?.received || 0;

        // Check per-simulation send limit
        if (sent >= messagesPerSession) return false;

        // Check daily total limit (sent + received)
        if ((sent + received) >= dailyLimit) return false;

        return true;
    },

    canReceiveMessage(sessionName: string, simulationId: string, messagesPerSession: number, dailyLimit: number): boolean {
        const counter = this.getMessageCounter(sessionName, simulationId);
        const sent = counter?.sent || 0;
        const received = counter?.received || 0;

        // Check per-simulation receive limit
        if (received >= messagesPerSession) return false;

        // Check daily total limit
        if ((sent + received) >= dailyLimit) return false;

        return true;
    },
};
