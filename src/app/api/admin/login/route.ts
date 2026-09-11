import { NextRequest, NextResponse } from 'next/server';
import {
    ADMIN_COOKIE,
    ADMIN_SESSION_MAX_AGE_SECONDS,
    adminSessionToken,
    isAdminAuthorized,
} from '@/lib/adminAuth';

type Result = { status: 'ok' } | { status: 'error'; message: string };

/** Exempt from the middleware gate, or signing in would require being signed in. */
export async function POST(req: NextRequest): Promise<NextResponse<Result>> {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
        // Fail closed rather than let an unconfigured deploy hand out sessions.
        return NextResponse.json({
            status: 'error',
            message: 'ADMIN_SECRET is not configured',
        }, { status: 500 });
    }

    const body = await req.json().catch(() => null) as { secret?: string }|null;
    if (!isAdminAuthorized(body?.secret ?? null, adminSecret)) {
        return NextResponse.json({ status: 'error', message: 'Invalid secret' }, { status: 401 });
    }

    const res = NextResponse.json<Result>({ status: 'ok' });
    res.cookies.set(ADMIN_COOKIE, await adminSessionToken(adminSecret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return res;
}
