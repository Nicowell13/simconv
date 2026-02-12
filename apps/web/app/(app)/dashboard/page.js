'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getToken } from '../../../lib/auth';

export default function DashboardPage() {
    const [token, setToken] = useState('');
    const [statusMap, setStatusMap] = useState({});
    const [sessions, setSessions] = useState([]);
    const [simulations, setSimulations] = useState([]);
    const [queueStatus, setQueueStatus] = useState(null);

    useEffect(() => { setToken(getToken()); }, []);

    useEffect(() => {
        if (!token) return;
        loadAll();
        const t = setInterval(loadAll, 5000);
        return () => clearInterval(t);
    }, [token]);

    async function loadAll() {
        try {
            const [sessData, statusData, simData, qData] = await Promise.all([
                apiFetch('/sessions', { token }),
                apiFetch('/waha/sessions/status', { token }).catch(() => ({ sessions: [] })),
                apiFetch('/simulations', { token }).catch(() => ({ simulations: [] })),
                apiFetch('/queue/status', { token }).catch(() => null),
            ]);
            setSessions(sessData?.sessions || []);
            const map = {};
            for (const s of statusData?.sessions || []) map[s.name] = s;
            setStatusMap(map);
            setSimulations(simData?.simulations || []);
            setQueueStatus(qData);
        } catch { }
    }

    const connectedCount = sessions.filter((s) => statusMap?.[s.wahaSession]?.connected).length;
    const activeSimulations = simulations.filter((s) => s.active);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-5">
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="mt-1 text-sm text-gray-600">Ringkasan status semua nomor dan simulasi.</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border bg-white p-5">
                    <div className="text-xs text-gray-600">Total Sessions</div>
                    <div className="mt-1 text-3xl font-semibold">{sessions.length}</div>
                </div>
                <div className="rounded-2xl border bg-white p-5">
                    <div className="text-xs text-gray-600">Connected</div>
                    <div className="mt-1 text-3xl font-semibold text-green-600">{connectedCount}</div>
                </div>
                <div className="rounded-2xl border bg-white p-5">
                    <div className="text-xs text-gray-600">Disconnected</div>
                    <div className="mt-1 text-3xl font-semibold text-red-600">{sessions.length - connectedCount}</div>
                </div>
                <div className="rounded-2xl border bg-white p-5">
                    <div className="text-xs text-gray-600">Active Simulations</div>
                    <div className="mt-1 text-3xl font-semibold text-blue-600">{activeSimulations.length}</div>
                </div>
            </div>

            {/* Session Status */}
            <section className="rounded-2xl border bg-white p-5">
                <h2 className="text-base font-semibold">Status Nomor</h2>
                <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-xs text-gray-600">
                                <th className="px-3 py-2">Session</th>
                                <th className="px-3 py-2">Phone</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2">Auto-Reply</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s) => {
                                const status = statusMap?.[s.wahaSession];
                                return (
                                    <tr key={s.id} className="border-b">
                                        <td className="px-3 py-2 font-mono text-xs">{s.wahaSession}</td>
                                        <td className="px-3 py-2 text-xs">{status?.phoneNumber || '-'}</td>
                                        <td className="px-3 py-2">
                                            {status?.connected ? (
                                                <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Connected</span>
                                            ) : (
                                                <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Disconnected</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-xs">{s.autoReplyEnabled ? '✓' : '—'}</td>
                                    </tr>
                                );
                            })}
                            {sessions.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-gray-500">Belum ada session.</td></tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Queue Status */}
            {queueStatus ? (
                <section className="rounded-2xl border bg-white p-5">
                    <h2 className="text-base font-semibold">Send Queue</h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border bg-gray-50 px-4 py-3">
                            <div className="text-xs text-gray-600">Workers</div>
                            <div className="mt-1 text-lg font-semibold">{queueStatus.maxConcurrentWorkers}</div>
                        </div>
                        <div className="rounded-xl border bg-gray-50 px-4 py-3">
                            <div className="text-xs text-gray-600">Daily Limit/Session</div>
                            <div className="mt-1 text-lg font-semibold">{queueStatus.config?.dailyLimit}</div>
                        </div>
                        <div className="rounded-xl border bg-gray-50 px-4 py-3">
                            <div className="text-xs text-gray-600">Human Behavior</div>
                            <div className="mt-1 text-lg font-semibold">{queueStatus.config?.humanBehavior ? 'ON' : 'OFF'}</div>
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                        Delay: {Math.round(queueStatus.config?.delayMin / 1000)}s – {Math.round(queueStatus.config?.delayMax / 1000)}s |
                        Cooldown setiap {queueStatus.config?.cooldownEvery} pesan
                    </div>
                </section>
            ) : null}

            {/* Simulation History */}
            {simulations.length > 0 ? (
                <section className="rounded-2xl border bg-white p-5">
                    <h2 className="text-base font-semibold">Riwayat Simulasi</h2>
                    <div className="mt-4 space-y-2">
                        {simulations.map((sim) => (
                            <div key={sim.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium">{sim.name}</div>
                                    <div className="text-xs text-gray-500">{new Date(sim.createdAt).toLocaleString()} | {sim.sessionNames?.length || 0} sessions</div>
                                </div>
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sim.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {sim.active ? 'Active' : 'Stopped'}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}
