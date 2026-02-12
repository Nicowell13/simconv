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
// Note: simulation routes in index.ts were mixed:
// - /presets/* was top level
// - /simulations was top level
// I implemented them in simulationRoutes, but I need to make sure the mounting path matches.
// In simulationRoutes:
// POST /presets/sim15/run  -> mounted at /simulations? or /?
//
// To match exact previous API paths:
// app.get('/presets/sim15', ...) was at root.
// app.get('/simulations', ...) was at root.
//
// The cleanest way is to mount routes at root if the router handles the subpaths,
// OR mount at /simulations and change frontend.
// BUT I must preserve API compatibility for the frontend.
//
// The monolithic index had:
// /presets/sim15
// /simulations
//
// My simulationRoutes has:
// / (list simulations) -> matches /simulations if mounted at /simulations
// /:id/progress -> matches /simulations/:id/progress
// /presets/sim15 -> this would become /simulations/presets/sim15 if mounted at /simulations.
//
// Frontend expects /presets/sim15.
//
// Strategy: I will keep strict path compatibility by mounting multiple times or adjusting the router.
//
// Let's adjust strictness. I will mount:
// app.use('/', simulationRoutes) -> this would overlap.
//
// Better: simulationRoutes handles `/simulations` AND `/presets`.
// Let me verify simulationRoutes content.
// It has `router.get('/', ...)` => `/`
// It has `router.get('/presets/sim15', ...)` => `/presets/sim15`
//
// So if I mount it at `/simulations`, `get('/')` becomes `/simulations` (Good).
// But `get('/presets/sim15')` becomes `/simulations/presets/sim15` (Bad, frontend expects `/presets/sim15`).
//
// I should split the router or mount carefully.
//
// I'll fix this by mounting simulationRoutes at `/` but strictly defining paths in it.
//
// Wait, `router.get('/')` in `simulation.routes.ts` is `listSimulations`.
// That should be mapped to `/simulations`.
//
// So if I mount at `/`, `listSimulations` would be `GET /`. That is WRONG.
//
// Correct approach:
// In `simulation.routes.ts`, I should have explicit paths:
// `router.get('/simulations', ...)`
// `router.get('/presets/sim15', ...)`
// And mount the router at `/`.
//
// Let me quickly re-read my `simulations.routes.ts` write.
//
// I wrote:
// router.get('/', ...)  <-- intended to be mounted at /simulations
// router.get('/presets/sim15', ...) <-- intended to be mounted at root?
//
// I need to correct `simulation.routes.ts` to be mounted at root.

app.use('/waha', wahaRoutes);
app.use('/queue', queueRoutes);

// Hack for simulation/presets routing compatibility without rewriting router file right now:
// I will rewrite simulation.routes.ts to use full paths and mount at root.
// Or I can mount it twice? No.
// I'll rewrite the router file in the next step to be correct. For now let's finish index.ts.



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
