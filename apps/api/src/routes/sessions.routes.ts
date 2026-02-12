import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { wahaDeleteSession } from '../services/waha.service.js';
import { SIM15_PRESET } from '../presets/sim15Preset.js';

const router = Router();

const sessionCreateSchema = z.object({
    wahaSession: z.string().min(1),
    autoReplyEnabled: z.boolean().optional().default(true),
    autoReplyMode: z.enum(['static', 'script']).optional().default('script'),
    scriptLineParity: z.enum(['odd', 'even', 'all']).optional().default('all'),
    autoReplyText: z.string().optional().default('Terima kasih, pesan Anda sudah kami terima.'),
    autoReplyScriptText: z.string().optional().default(SIM15_PRESET.scriptText),
});

const sessionUpdateSchema = z.object({
    autoReplyEnabled: z.boolean().optional(),
    autoReplyMode: z.enum(['static', 'script']).optional(),
    scriptLineParity: z.enum(['odd', 'even', 'all']).optional(),
    autoReplyText: z.string().optional(),
    autoReplyScriptText: z.string().optional(),
});

router.use(requireAuth);

router.get('/', (_req, res) => {
    res.json({ sessions: db.listSessions() });
});

router.post('/', (req, res) => {
    const parsed = sessionCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    if (db.getSessionByName(parsed.data.wahaSession)) {
        return res.status(409).json({ error: 'Session already exists' });
    }

    const created = db.upsertSession({
        id: randomUUID(),
        wahaSession: parsed.data.wahaSession,
        autoReplyEnabled: parsed.data.autoReplyEnabled,
        autoReplyMode: parsed.data.autoReplyMode,
        scriptLineParity: parsed.data.scriptLineParity,
        autoReplyText: parsed.data.autoReplyText,
        autoReplyScriptText: parsed.data.autoReplyScriptText,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({ session: created });
});

router.patch('/:id', (req, res) => {
    const existing = db.getSessionById(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'Not found' });
    }

    const parsed = sessionUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }

    const updated = db.upsertSession({
        ...existing,
        ...parsed.data,
        id: existing.id,
        wahaSession: existing.wahaSession,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
    });

    return res.json({ session: updated });
});

router.delete('/:id', (req, res) => {
    const existing = db.getSessionById(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'Not found' });
    }

    return (async () => {
        try {
            await wahaDeleteSession(existing.wahaSession);
        } catch (e: any) {
            const msg = String(e?.message || '');
            const notFound = msg.includes('404') || msg.toLowerCase().includes('not found');
            if (!notFound) {
                return res.status(502).json({ error: e?.message || 'WAHA error' });
            }
        }

        const ok = db.deleteSession(req.params.id);
        if (!ok) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.status(204).send();
    })();
});

export const sessionRoutes = router;
