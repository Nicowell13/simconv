import { Router } from 'express';
import { z } from 'zod';
import { verifyAdminPassword, signToken } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt:', req.body);
        const loginSchema = z.object({
            username: z.string().min(1),
            password: z.string().min(1),
        });

        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            console.log('Login validation failed:', parsed.error);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Checking admin credentials for:', parsed.data.username);
        if (parsed.data.username !== (process.env.ADMIN_USERNAME || 'admin')) {
            console.log('Username mismatch');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Verifying password...');
        const ok = await verifyAdminPassword(parsed.data.password);
        if (!ok) {
            console.log('Password verification failed');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        console.log('Signing token...');
        const token = signToken({ sub: 'admin', username: parsed.data.username });
        console.log('Login successful');
        return res.json({ token });
    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

export const authRoutes = router;
