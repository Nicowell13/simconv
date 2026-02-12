'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { getToken } from '../../../lib/auth';

export default function SimulationPage() {
    const [token, setToken] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const [timezone, setTimezone] = useState('Asia/Jakarta');
    const [windowStart, setWindowStart] = useState('08:00');
    const [windowEnd, setWindowEnd] = useState('22:00');
    const [messagesPerSession, setMessagesPerSession] = useState(10);
    const [dailyLimit, setDailyLimit] = useState(50);

    const [simulations, setSimulations] = useState([]);
    const [selectedSimId, setSelectedSimId] = useState('');
    const [progress, setProgress] = useState(null);
    const [progressError, setProgressError] = useState('');

    useEffect(() => {
        setToken(getToken());
    }, []);

    useEffect(() => {
        if (!token) return;
        loadSimulations();
    }, [token]);

    async function loadSimulations() {
        try {
            const data = await apiFetch('/simulations', { token });
            setSimulations(data?.simulations || []);
            // Auto-select latest active simulation
            const active = (data?.simulations || []).filter((s) => s.active);
            if (active.length > 0) {
                setSelectedSimId(active[active.length - 1].id);
            }
        } catch { }
    }

    async function startSimulation() {
        setRunning(true);
        setError('');
        setResult(null);

        try {
            const data = await apiFetch('/presets/sim15/run', {
                token,
                method: 'POST',
                body: { timezone, windowStart, windowEnd, messagesPerSession, dailyLimitPerSession: dailyLimit },
            });
            setResult(data);
            if (data?.simulation?.id) {
                setSelectedSimId(data.simulation.id);
            }
            await loadSimulations();
        } catch (e) {
            setError(e?.message || 'Gagal menjalankan simulasi');
        } finally {
            setRunning(false);
        }
    }

    async function refreshProgress(simId) {
        if (!simId || !token) return;
        try {
            const data = await apiFetch(`/simulations/${simId}/progress`, { token });
            setProgress(data);
            setProgressError('');
        } catch (e) {
            setProgressError(e?.message || 'Gagal ambil progress');
        }
    }

    async function stopSimulation() {
        if (!selectedSimId || !token) return;
        setProgressError('');
        try {
            await apiFetch(`/simulations/${selectedSimId}/stop`, { token, method: 'POST' });
            await refreshProgress(selectedSimId);
            await loadSimulations();
        } catch (e) {
            setProgressError(e?.message || 'Gagal stop simulasi');
        }
    }

    useEffect(() => {
        if (!selectedSimId || !token) return;
        refreshProgress(selectedSimId);
        const t = setInterval(() => refreshProgress(selectedSimId), 3000);
        return () => clearInterval(t);
    }, [selectedSimId, token]);

    const summary = progress?.summary;
    const counters = progress?.counters || [];
    const nextDueAt = summary?.nextDueAt ? new Date(summary.nextDueAt) : null;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-5">
                <h1 className="text-xl font-semibold">Simulasi Percakapan</h1>
                <p className="mt-1 text-sm text-gray-600">
                    15 nomor peer-to-peer saling berkirim pesan. Setiap nomor mengirim dan menerima max {messagesPerSession} pesan.
                </p>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            <section className="rounded-2xl border bg-white p-5">
                <h2 className="text-base font-semibold">Mulai Simulasi Baru</h2>
                <p className="mt-1 text-sm text-gray-600">Pastikan semua session sudah di-pair sebelum memulai.</p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Timezone</label>
                        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Window Start</label>
                        <input value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20" placeholder="08:00" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Window End</label>
                        <input value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20" placeholder="22:00" />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Pesan per Session</label>
                        <input type="number" value={messagesPerSession} onChange={(e) => setMessagesPerSession(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20" />
                        <p className="mt-1 text-xs text-gray-500">Maks pesan kirim per nomor</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Daily Limit</label>
                        <input type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-900/20" />
                        <p className="mt-1 text-xs text-gray-500">Maks total pesan (kirim+terima) per nomor per hari</p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                        disabled={running}
                        onClick={startSimulation}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                        {running ? 'Memulai...' : '🚀 Mulai Simulasi'}
                    </button>
                </div>

                {result?.ok ? (
                    <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        ✅ Simulasi dimulai! {result.message}
                    </div>
                ) : null}
            </section>

            {/* Live Progress Section */}
            <section className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold">Live Progress</h2>
                        <p className="mt-1 text-sm text-gray-600">Progress simulasi yang sedang berjalan (auto update).</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={selectedSimId} onChange={(e) => setSelectedSimId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
                            <option value="">Pilih simulasi...</option>
                            {simulations.map((s) => (
                                <option key={s.id} value={s.id}>{s.name} {s.active ? '(active)' : ''}</option>
                            ))}
                        </select>
                        <button type="button" onClick={() => refreshProgress(selectedSimId)} disabled={!selectedSimId} className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                            Refresh
                        </button>
                        <button type="button" onClick={stopSimulation} disabled={!selectedSimId} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60">
                            Stop
                        </button>
                    </div>
                </div>

                {progressError ? <div className="mt-2 text-sm text-red-700">{progressError}</div> : null}

                {summary ? (
                    <div className="mt-4 space-y-4">
                        {/* Progress Bar */}
                        <div>
                            <div className="flex justify-between text-sm text-gray-700">
                                <span>Progress</span>
                                <span>{summary.sent}/{summary.total} tasks selesai</span>
                            </div>
                            <div className="mt-1 h-3 overflow-hidden rounded-full bg-gray-200">
                                <div
                                    className="h-full rounded-full bg-gray-900 transition-all duration-500"
                                    style={{ width: `${Math.round((summary.sent / Math.max(1, summary.total)) * 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-xl border bg-gray-50 px-4 py-3">
                                <div className="text-xs text-gray-600">Total Tasks</div>
                                <div className="mt-1 text-xl font-semibold">{summary.total}</div>
                            </div>
                            <div className="rounded-xl border bg-green-50 px-4 py-3">
                                <div className="text-xs text-green-600">Sent</div>
                                <div className="mt-1 text-xl font-semibold text-green-700">{summary.sent}</div>
                            </div>
                            <div className="rounded-xl border bg-amber-50 px-4 py-3">
                                <div className="text-xs text-amber-600">Pending</div>
                                <div className="mt-1 text-xl font-semibold text-amber-700">{summary.pending}</div>
                            </div>
                            <div className="rounded-xl border bg-red-50 px-4 py-3">
                                <div className="text-xs text-red-600">Error</div>
                                <div className="mt-1 text-xl font-semibold text-red-700">{summary.error}</div>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-700">
                            Next due: <span className="font-medium">{nextDueAt ? nextDueAt.toLocaleString() : '-'}</span>
                        </div>

                        {/* Per-session counters */}
                        {counters.length > 0 ? (
                            <div>
                                <div className="text-sm font-medium text-gray-800">Per-Session Message Counters</div>
                                <div className="mt-2 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-xs text-gray-600">
                                                <th className="px-3 py-2">Session</th>
                                                <th className="px-3 py-2 text-center">Sent</th>
                                                <th className="px-3 py-2 text-center">Received</th>
                                                <th className="px-3 py-2 text-center">Total</th>
                                                <th className="px-3 py-2">Progress</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {counters.map((c) => {
                                                const total = (c.sent || 0) + (c.received || 0);
                                                const pct = Math.round(((c.sent || 0) / Math.max(1, messagesPerSession)) * 100);
                                                return (
                                                    <tr key={c.sessionName} className="border-b">
                                                        <td className="px-3 py-2 font-mono text-xs">{c.sessionName}</td>
                                                        <td className="px-3 py-2 text-center">{c.sent || 0}</td>
                                                        <td className="px-3 py-2 text-center">{c.received || 0}</td>
                                                        <td className="px-3 py-2 text-center">{total}/{dailyLimit}</td>
                                                        <td className="px-3 py-2">
                                                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                                                                <div className="h-full rounded-full bg-gray-900 transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : null}

                        {summary?.recentErrors?.length ? (
                            <div className="rounded-xl border bg-gray-50 p-4">
                                <div className="mb-2 text-xs text-gray-600">Recent errors</div>
                                <div className="space-y-1 text-xs">
                                    {summary.recentErrors.map((e, idx) => (
                                        <div key={`${e.dueAt}-${idx}`} className="flex flex-wrap gap-2">
                                            <span className="font-mono">{new Date(e.dueAt).toLocaleString()}</span>
                                            {e.senderSession ? <span className="font-mono">{e.senderSession}</span> : null}
                                            <span className="font-mono">{e.chatId}</span>
                                            {e.lastError ? <span className="text-gray-600">— {e.lastError}</span> : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="mt-4 text-xs text-gray-500">Mulai simulasi dulu untuk melihat progress.</div>
                )}
            </section>
        </div>
    );
}
