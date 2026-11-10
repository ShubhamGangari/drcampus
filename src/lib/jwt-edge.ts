/*
 * Edge-safe JWT (HS256) verification built on the Web Crypto API.
 *
 * Next.js middleware runs on the Edge runtime, where Node-only modules such as
 * jsonwebtoken / bcryptjs are unavailable. This module is kept dependency-free so
 * it can be bundled into the middleware safely. It verifies the HMAC-SHA256
 * signature and rejects expired tokens — the same guarantees `verifyToken` in
 * `src/lib/auth.ts` provides on the Node server.
 *
 * The signing secret is referenced directly (as `process.env.JWT_SECRET`) so
 * Next can inline it into both the Node and Edge bundles consistently.
 */

const encoder = new TextEncoder();

function b64UrlDecode(input: string): Uint8Array {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function parsePayload<T>(segment: string): T | null {
    try {
        const bytes = b64UrlDecode(segment);
        return JSON.parse(new TextDecoder().decode(bytes)) as T;
    } catch {
        return null;
    }
}

/** Copies bytes into a plain ArrayBuffer so it satisfies BufferSource typing. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buf = new ArrayBuffer(bytes.length);
    new Uint8Array(buf).set(bytes);
    return buf;
}

async function signHmacSha256(data: Uint8Array, secret: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(encoder.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, toArrayBuffer(data)));
}

/**
 * Verifies a JWT signed with HS256 using the JWT_SECRET env secret.
 * Returns the decoded payload when the signature is valid and the token has not
 * expired; returns null otherwise. Never throws.
 */
export async function verifyJwtEdge(token: string): Promise<Record<string, unknown> | null> {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    const header = parsePayload<{ alg?: string; typ?: string }>(headerB64);
    if (!header || header.alg !== 'HS256') return null;

    const expectedSig = b64UrlDecode(signatureB64);

    const signingInput = `${headerB64}.${payloadB64}`;
    const computedSig = await signHmacSha256(encoder.encode(signingInput), secret);

    // Constant-time-style comparison to avoid leaking timing information.
    if (computedSig.length !== expectedSig.length) return null;
    let diff = 0;
    for (let i = 0; i < computedSig.length; i++) {
        diff |= computedSig[i] ^ expectedSig[i];
    }
    if (diff !== 0) return null;

    const payload = parsePayload<Record<string, unknown>>(payloadB64);
    if (!payload) return null;

    const exp = payload.exp;
    if (typeof exp === 'number') {
        const now = Math.floor(Date.now() / 1000);
        if (exp < now) return null;
    }

    return payload;
}
