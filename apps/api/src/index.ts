import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { startScheduler } from './scheduler.js';
import { authRoutes } from './routes/auth.routes.js';
import { sessionRoutes } from './routes/sessions.routes.js';
import { simulationRoutes } from './routes/simulations.routes.js';
import { wahaRoutes } from './routes/waha.routes.js';
import { queueRoutes } from './routes/queue.routes.js';

const app = express();

// Request Logging Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: '2mb' }));
app.use(
    cors({
        origin: true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
);

app.get('/health', (_req, res) => {
    res.json({ ok: true });
});

// Mount Routes
app.use('/auth', authRoutes);
app.use('/sessions', sessionRoutes);
app.use(simulationRoutes);
app.use('/waha', wahaRoutes);
app.use('/queue', queueRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err?.message || String(err) });
});

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
    console.log(`🚀 Conversation Sim API listening on port ${PORT}`);
    startScheduler();
});
