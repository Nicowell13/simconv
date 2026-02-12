import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { db } from '../db.js';
import { runSim15Simulation } from '../services/simulation.service.js';
import { SIM15_PRESET } from '../presets/sim15Preset.js';
import { randomUUID } from 'node:crypto';

const router = Router();

router.use(requireAuth);

// Mounted at root /

router.get('/simulations', (_req, res) => {
    res.json({ simulations: db.listSimulations() });
});

router.get('/simulations/:id/progress', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing simulation id' });

    const sim = db.getSimulationById(id);
    if (!sim) return res.status(404).json({ error: 'Simulation not found' });

    const summary = db.getSimulationProgressSummary(id);
    const counters = db.getAllMessageCounters(id);

    return res.json({ simulation: sim, summary, counters });
});

router.post('/simulations/:id/stop', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing simulation id' });

    const sim = db.getSimulationById(id);
    if (!sim) return res.status(404).json({ error: 'Simulation not found' });

    db.upsertSimulation({ ...sim, active: false });
    const cancelled = db.cancelPendingTasksForSimulation(id);
    db.setSuppressAutoReplyUntil(null);

    return res.json({ ok: true, cancelled });
});

// Presets (SIM15)
router.get('/presets/sim15', (_req, res) => {
    return res.json({
        ok: true,
        preset: {
            sessionNames: SIM15_PRESET.sessionNames,
            automationDefaults: SIM15_PRESET.automationDefaults,
        },
    });
});

router.post('/presets/sim15/init', (_req, res) => {
    const upserted: any[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const name of SIM15_PRESET.sessionNames) {
        const existing = db.getSessionByName(name);
        if (existing) {
            const updated = db.upsertSession({
                ...existing,
                autoReplyEnabled: true,
                autoReplyMode: 'script',
                scriptLineParity: 'all',
                autoReplyScriptText: SIM15_PRESET.scriptText,
            });
            updatedCount += 1;
            upserted.push(updated);
            continue;
        }

        const created = db.upsertSession({
            id: randomUUID(),
            wahaSession: name,
            autoReplyEnabled: true,
            autoReplyMode: 'script',
            scriptLineParity: 'all',
            autoReplyText: 'Terima kasih, pesan Anda sudah kami terima.',
            autoReplyScriptText: SIM15_PRESET.scriptText,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        createdCount += 1;
        upserted.push(created);
    }

    return res.json({ ok: true, upserted, createdCount, updatedCount });
});

router.post('/presets/sim15/run', async (req, res) => {
    try {
        const result = await runSim15Simulation(req.body);
        return res.json(result);
    } catch (e: any) {
        console.error('Error running simulation:', e);
        return res.status(400).json({ error: e?.message });
    }
});

export const simulationRoutes = router;
