import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { getSendQueueStatus } from '../sendQueue.js';

const router = Router();

router.use(requireAuth);

router.get('/status', (_req, res) => {
    return res.json(getSendQueueStatus());
});

export const queueRoutes = router;
