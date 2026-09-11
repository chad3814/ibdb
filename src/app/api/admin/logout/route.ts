import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/adminAuth';

export async function POST(): Promise<NextResponse<{ status: 'ok' }>> {
    const res = NextResponse.json<{ status: 'ok' }>({ status: 'ok' });
    res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
}
