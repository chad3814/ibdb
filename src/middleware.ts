import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    
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
        '/book/:path*.json',
        '/isbn/:path*.json',
        '/book-json/:path*',
        '/isbn-json/:path*',
    ],
};