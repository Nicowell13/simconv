import { Router } from 'express';
import { z } from 'zod';
import { verifyAdminPassword, signToken } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
    const loginSchema = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
    });

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (parsed.data.username !== (process.env.ADMIN_USERNAME || 'admin')) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await verifyAdminPassword(parsed.data.password);
    if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ sub: 'admin', username: parsed.data.username });
    return res.json({ token });
});

export const authRoutes = router;
