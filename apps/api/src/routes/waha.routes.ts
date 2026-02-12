import { Router } from 'express';
import { requireAuth } from '../auth.js';
import {
    wahaListSessions,
    extractWahaSessionName,
    isWahaConnected,
    extractWahaPhoneNumber,
    wahaStartSession,
    wahaGetQrBase64,
    wahaRequestPairingCode
} from '../services/waha.service.js';

const router = Router();
// Webhooks are public
router.post('/webhook', (req, res) => {
    res.json({ ok: true });
});

router.post('/webhook/:sessionName', (req, res) => {
    res.json({ ok: true });
});

// All other WAHA routes require auth
router.use(requireAuth);

router.get('/sessions/status', async (_req, res) => {
    try {
        const list = await wahaListSessions(true);
        const arr = Array.isArray(list) ? list : [];
        const sessions = arr.map((raw: any) => ({
            name: extractWahaSessionName(raw),
            connected: isWahaConnected(raw),
            phoneNumber: extractWahaPhoneNumber(raw),
            raw,
        }));
        return res.json({ sessions });
    } catch (e: any) {
        return res.status(502).json({ error: e?.message || 'WAHA unreachable' });
    }
});

router.post('/sessions/:name/start', async (req, res) => {
    try {
        const data = await wahaStartSession(req.params.name);
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e?.message || 'WAHA error' });
    }
});

router.get('/sessions/:name/qr', async (req, res) => {
    try {
        const data = await wahaGetQrBase64(req.params.name);
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e?.message || 'WAHA error' });
    }
});

router.post('/sessions/:name/pairing-code', async (req, res) => {
    const phoneNumber = String(req.body?.phoneNumber || '');
    if (!phoneNumber.trim()) return res.status(400).json({ error: 'phoneNumber is required' });

    try {
        const data = await wahaRequestPairingCode(req.params.name, phoneNumber);
        return res.json(data);
    } catch (e: any) {
        return res.status(502).json({ error: e?.message || 'WAHA error' });
    }
});

export const wahaRoutes = router;
