// WAHA Service

// I will put the helpers here.

type WahaSendTextParams = {
    session: string;
    chatId: string;
    text: string;
};

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || 'http://localhost:3001';
const WAHA_API_KEY = process.env.WAHA_API_KEY;

function wahaHeaders(extra?: Record<string, string>) {
    return {
        ...(WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {}),
        ...extra,
    };
}

async function wahaRequestJson(path: string, init: RequestInit = {}) {
    const url = `${WAHA_BASE_URL}${path}`;
    const method = init.method || 'GET';
    const headers = wahaHeaders({
        ...(init.headers as any),
    });
    console.log(`[WAHA] Request ${method} ${url}`, {
        headers: { ...headers, 'X-Api-Key': headers['X-Api-Key'] ? '***' : 'MISSING' }
    });

    const res = await fetch(url, {
        ...init,
        headers,
    });

    if (res.status === 204) {
        return {};
    }

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (res.status === 401) {
            throw new Error(
                `WAHA request failed: 401 Unauthorized (${path}). Pastikan API key WAHA sudah diset. ${body}`
            );
        }
        if (res.status === 404) {
            throw new Error(
                `WAHA request failed: 404 Not Found (${path}). Session belum terbentuk/siap. ${body}`
            );
        }
        throw new Error(`WAHA request failed: ${res.status} ${res.statusText} (${path}) ${body}`);
    }

    return res.json().catch(() => ({}));
}

async function wahaCreateSession(name: string, start = true) {
    return wahaRequestJson('/api/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ name, start }),
    });
}

async function wahaDeprecatedStart(name: string) {
    return wahaRequestJson('/api/sessions/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ name }),
    });
}

export async function wahaSendText({ session, chatId, text }: WahaSendTextParams) {
    return wahaRequestJson('/api/sendText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session, chatId, text }),
    });
}

export async function wahaGetQrBase64(session: string) {
    return wahaRequestJson(`/api/${encodeURIComponent(session)}/auth/qr?format=image`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });
}

export async function wahaRequestPairingCode(session: string, phoneNumber: string) {
    return wahaRequestJson(`/api/${encodeURIComponent(session)}/auth/request-code`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
    });
}

export async function wahaStartSession(session: string) {
    try {
        await wahaCreateSession(session, false);
    } catch (e: any) {
        const msg = String(e?.message || '');
        const alreadyExists = msg.includes('409') || msg.toLowerCase().includes('already exists');
        if (!alreadyExists) throw e;
    }

    try {
        return await wahaRequestJson(`/api/sessions/${encodeURIComponent(session)}/start`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        });
    } catch (e: any) {
        const msg = String(e?.message || '');
        const notFound = msg.includes('404') || msg.toLowerCase().includes('session not found');
        if (!notFound) throw e;

        return wahaDeprecatedStart(session);
    }
}

export async function wahaListSessions(all = true) {
    const query = all ? '?all=true' : '';
    return wahaRequestJson(`/api/sessions${query}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });
}

export async function wahaDeleteSession(session: string) {
    return wahaRequestJson(`/api/sessions/${encodeURIComponent(session)}`, {
        method: 'DELETE',
        headers: {
            Accept: 'application/json',
        },
    });
}

// ===== Human-like Behavior Helpers =====

export async function wahaSendSeen(session: string, chatId: string) {
    return wahaRequestJson('/api/sendSeen', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session, chatId }),
    });
}

export async function wahaStartTyping(session: string, chatId: string) {
    return wahaRequestJson('/api/startTyping', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session, chatId }),
    });
}

export async function wahaStopTyping(session: string, chatId: string) {
    return wahaRequestJson('/api/stopTyping', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session, chatId }),
    });
}

// ===== Helpers moved from index.ts =====

export function normalizePhoneNumber(value: string): string {
    return String(value || '').replace(/[^0-9]/g, '');
}

export function extractWahaSessionName(raw: any): string {
    return String(raw?.name || raw?.session || '');
}

export function extractWahaPhoneNumber(raw: any): string | null {
    // Try me.id first (e.g. "6281234567890@c.us")
    if (typeof raw?.me?.id === 'string') {
        const digits = normalizePhoneNumber(raw.me.id.split('@')[0]);
        if (digits.length >= 8) return digits;
    }
    // Try config.proxyNumber
    if (typeof raw?.config?.proxyNumber === 'string') {
        const digits = normalizePhoneNumber(raw.config.proxyNumber);
        if (digits.length >= 8) return digits;
    }
    // Fallback: session name itself if it looks like a phone number
    const name = extractWahaSessionName(raw);
    const digits = normalizePhoneNumber(name);
    if (digits.length >= 8) return digits;
    return null;
}

export function isWahaConnected(raw: any): boolean {
    const status = String(raw?.status || '').toUpperCase();
    if (status === 'WORKING' || status === 'CONNECTED') return true;
    if (raw?.engine?.state === 'CONNECTED') return true;
    if (raw?.me?.id) return true;
    return false;
}

export async function getSessionToChatIdMap(): Promise<Record<string, string>> {
    try {
        const list = await wahaListSessions(true);
        const arr = Array.isArray(list) ? list : [];
        const result: Record<string, string> = {};
        for (const raw of arr) {
            const name = extractWahaSessionName(raw);
            if (!name) continue;
            if (!isWahaConnected(raw)) continue;
            const phone = extractWahaPhoneNumber(raw);
            if (phone) {
                result[name] = `${phone}@c.us`;
            }
        }
        return result;
    } catch (e: any) {
        console.error('Error getting session to chatId map:', e?.message);
        return {};
    }
}
