import { randomUUID } from 'node:crypto';

interface NonceRecord {
    nonce: string;
    expiresAt: number;
    consumed: boolean;
}

interface GrantRecord {
    grant: string;
    nonce: string;
    userId: string;
    sessionToken: string;
    expiresAt: number;
    consumed: boolean;
}

const NONCE_TTL_MS = 5 * 60_000;
const GRANT_TTL_MS = 2 * 60_000;

const nonceStore = new Map<string, NonceRecord>();
const grantStore = new Map<string, GrantRecord>();

function cleanupExpired(): void {
    const now = Date.now();

    for (const [nonce, record] of nonceStore.entries()) {
        if (record.expiresAt < now || record.consumed) {
            nonceStore.delete(nonce);
        }
    }

    for (const [grant, record] of grantStore.entries()) {
        if (record.expiresAt < now || record.consumed) {
            grantStore.delete(grant);
        }
    }
}

export function createDesktopNonce(nonce: string): void {
    cleanupExpired();
    nonceStore.set(nonce, {
        nonce,
        expiresAt: Date.now() + NONCE_TTL_MS,
        consumed: false,
    });
}

export function hasValidDesktopNonce(nonce: string): boolean {
    cleanupExpired();
    const record = nonceStore.get(nonce);
    return !!record && !record.consumed && record.expiresAt > Date.now();
}

export function issueDesktopGrant(params: { nonce: string; userId: string; sessionToken: string }): string {
    cleanupExpired();
    const nonceRecord = nonceStore.get(params.nonce);

    if (!nonceRecord || nonceRecord.consumed || nonceRecord.expiresAt <= Date.now()) {
        throw new Error('Invalid or expired nonce');
    }

    const grant = randomUUID();
    grantStore.set(grant, {
        grant,
        nonce: params.nonce,
        userId: params.userId,
        sessionToken: params.sessionToken,
        expiresAt: Date.now() + GRANT_TTL_MS,
        consumed: false,
    });

    return grant;
}

export function consumeDesktopGrant(params: { nonce: string; grant: string }): { userId: string; sessionToken: string } {
    cleanupExpired();

    const grantRecord = grantStore.get(params.grant);
    if (!grantRecord || grantRecord.consumed || grantRecord.expiresAt <= Date.now()) {
        throw new Error('Invalid or expired grant');
    }

    if (grantRecord.nonce !== params.nonce) {
        throw new Error('Grant nonce mismatch');
    }

    const nonceRecord = nonceStore.get(params.nonce);
    if (!nonceRecord || nonceRecord.consumed || nonceRecord.expiresAt <= Date.now()) {
        throw new Error('Invalid or expired nonce');
    }

    grantRecord.consumed = true;
    nonceRecord.consumed = true;

    return {
        userId: grantRecord.userId,
        sessionToken: grantRecord.sessionToken,
    };
}
