import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, isAdminRequestAuthorized, requiresAdminAuth } from '@/lib/adminAuth';

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const searchParams = request.nextUrl.searchParams;

    // One gate for every admin page and API route. Checking here rather than in
    // each handler means a route added later is covered by default -- four of
    // the nine /api/admin routes had drifted open under the per-handler
    // approach, including two that mutate data.
    if (requiresAdminAuth(pathname)) {
        const authorized = await isAdminRequestAuthorized({
            headerSecret: request.headers.get('x-secret'),
            cookieValue: request.cookies.get(ADMIN_COOKIE)?.value ?? null,
            adminSecret: process.env.ADMIN_SECRET,
        });

        if (!authorized) {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json({
                    status: 'error',
                    message: 'Unauthorized',
                }, { status: 401 });
            }
            const login = new URL('/admin/login', request.url);
            login.searchParams.set('next', pathname);
            return NextResponse.redirect(login);
        }
    }
    
    // Handle /search?q= - always serve JSON for backward compatibility
    // This endpoint is now API-only, web users should use /books
    if (pathname === '/search' && searchParams.has('q')) {
        const url = new URL(`/api/search`, request.url);
        url.search = request.nextUrl.search;
        return NextResponse.rewrite(url);
    }
    
    // Handle /book/[id].json redirects
    if (pathname.startsWith('/book/') && pathname.endsWith('.json')) {
        const id = pathname.slice(6, -5); // Remove '/book/' and '.json'
        const url = new URL(`/api/book-json/${id}`, request.url);
        return NextResponse.rewrite(url);
    }
    
    // Handle /isbn/[isbn].json redirects
    if (pathname.startsWith('/isbn/') && pathname.endsWith('.json')) {
        const isbn = pathname.slice(6, -5); // Remove '/isbn/' and '.json'
        const url = new URL(`/api/isbn-json/${isbn}`, request.url);
        return NextResponse.rewrite(url);
    }
    
    // Handle old /book-json/[id] redirects (backwards compatibility)
    if (pathname.startsWith('/book-json/')) {
        const id = pathname.slice(11); // Remove '/book-json/'
        const url = new URL(`/book/${id}.json`, request.url);
        return NextResponse.redirect(url, 301); // Permanent redirect
    }
    
    // Handle old /isbn-json/[isbn] redirects (backwards compatibility)
    if (pathname.startsWith('/isbn-json/')) {
        const isbn = pathname.slice(11); // Remove '/isbn-json/'
        const url = new URL(`/isbn/${isbn}.json`, request.url);
        return NextResponse.redirect(url, 301); // Permanent redirect
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: [
        '/search',
        '/book/:path*.json',
        '/isbn/:path*.json',
        '/book-json/:path*',
        '/isbn-json/:path*',
        '/admin',
        '/admin/:path*',
        '/api/admin/:path*',
    ],
};