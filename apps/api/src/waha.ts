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
    const res = await fetch(url, {
        ...init,
        headers: wahaHeaders({
            ...(init.headers as any),
        }),
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

async function wahaEnsureSessionExists(name: string) {
    try {
        await wahaCreateSession(name, true);
    } catch (e: any) {
        const msg = String(e?.message || '');
        const alreadyExists = msg.includes('409') || msg.toLowerCase().includes('already exists');
        if (!alreadyExists) throw e;
    }
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
