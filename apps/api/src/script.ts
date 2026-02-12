export type ScriptParity = 'odd' | 'even' | 'all';

export function parseScript(scriptText: string): string[][] {
    const normalized = (scriptText || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const blocks = normalized
        .split(/\n\s*\n+/g)
        .map((b) => b.trim())
        .filter(Boolean);

    return blocks
        .map((block) =>
            block
                .split(/\n+/g)
                .map((line) => line.trim())
                .filter(Boolean)
        )
        .filter((seasonLines) => seasonLines.length > 0);
}

export function matchesParity(lineIndex: number, parity: ScriptParity) {
    if (parity === 'all') return true;
    const isEvenIndex = lineIndex % 2 === 0;
    return parity === 'odd' ? isEvenIndex : !isEvenIndex;
}

export function getRandomStartLine(scriptText: string, parity: ScriptParity): number {
    const seasons = parseScript(scriptText);
    if (seasons.length === 0 || parity === 'all') return 0;

    const firstSeason = seasons[0];
    const validIndices: number[] = [];

    for (let i = 0; i < firstSeason.length; i++) {
        if (matchesParity(i, parity)) {
            validIndices.push(i);
        }
    }

    if (validIndices.length === 0) return 0;

    return validIndices[Math.floor(Math.random() * validIndices.length)];
}

export function pickReplyFromScript(
    scriptText: string,
    seasonIndex: number,
    lineIndex: number,
    parity: ScriptParity
): { text: string; nextSeasonIndex: number; nextLineIndex: number } | null {
    const seasons = parseScript(scriptText);
    if (seasons.length === 0) return null;

    let s = seasonIndex % seasons.length;
    let i = lineIndex;
    let attempts = 0;
    const maxAttempts = seasons.length * 2;

    while (attempts < maxAttempts) {
        attempts += 1;
        const lines = seasons[s] || [];

        while (i < lines.length && !matchesParity(i, parity)) {
            i += 1;
        }

        if (i < lines.length) {
            const step = parity === 'all' ? 1 : 2;
            const nextI = i + step;
            if (nextI >= lines.length) {
                return { text: lines[i], nextSeasonIndex: (s + 1) % seasons.length, nextLineIndex: 0 };
            }
            return { text: lines[i], nextSeasonIndex: s, nextLineIndex: nextI };
        }

        s = (s + 1) % seasons.length;
        i = 0;
    }

    const firstLines = seasons[0] || [];
    for (let idx = 0; idx < firstLines.length; idx++) {
        if (matchesParity(idx, parity)) {
            const step = parity === 'all' ? 1 : 2;
            return { text: firstLines[idx], nextSeasonIndex: 0, nextLineIndex: idx + step };
        }
    }

    return null;
}

export function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
}
