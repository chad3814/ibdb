import { ApiBook } from "@/api";
import { getApiBook } from "@/apiConvert";
import { db } from "@/server/db";
import { search } from "@/server/isbndb";
import { cleanQuery } from "@/lib/searchQuery";
import { hashClientIp } from "@/lib/clientHash";
import { SEARCH_BUCKET } from "@/lib/tokenBucket";
import { takeSearchToken } from "@/server/searchRateLimit";
import { NEGATIVE_CACHE_TTL_MS, isFresh } from "@/lib/cacheTtl";
import { NextRequest, NextResponse } from "next/server";

type SearchResultSuccess = {
    status: 'ok';
    books: ApiBook[];
};

type SearchResultError = {
    status: 'error';
    message: string;
};

type SearchResult = SearchResultSuccess|SearchResultError;

export async function GET(req: NextRequest): Promise<NextResponse<SearchResult>> {
    const q = req.nextUrl.searchParams.get('q');
    if (!q) {
        const err: SearchResultError = {
            status: 'error',
            message: 'No Query Specified',
        };
        return NextResponse.json(err, {status: 401});
    }

    const query = cleanQuery(q);
    if (!query) {
        // A query of nothing but punctuation or whitespace normalizes away to
        // nothing. It is not a search, and it must never reach ISBNdb: each
        // distinct run of spaces used to become its own cache key and its own
        // billed request.
        const err: SearchResultError = {
            status: 'error',
            message: 'No Query Specified',
        };
        return NextResponse.json(err, {status: 401});
    }

    const cached = await db.bookQuery.findFirst({
        where: {
            query,
        },
        select: {
            updatedAt: true,
            books: {
                include: {
                    authors: true,
                    editions: {
                        include: {
                            image: true
                        }
                    }
                }
            }
        }
    });

    // A cached hit is kept indefinitely; a cached miss only until it goes
    // stale, since ISBNdb does gain books over time.
    if (cached && (cached.books.length > 0 || isFresh(cached.updatedAt, NEGATIVE_CACHE_TTL_MS))) {
        return NextResponse.json({
            status: 'ok',
            books: cached.books.map(b => getApiBook(b))
        });
    }

    // Only misses reach ISBNdb, so only misses cost quota. Logging the client
    // here measures how concentrated that spend is; the Firewall tab shows raw
    // IPs but not per-path counts without Observability Plus. Hash a raw IP the
    // same way to match it against these lines:
    //   printf '<ip>' | shasum -a 256 | cut -c1-12
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? 'unknown';
    const client = await hashClientIp(clientIp);
    console.log(`isbndb miss client=${client} qlen=${query.length} rawlen=${q.length}`);

    // Only misses are limited: a cache hit costs no ISBNdb quota, so browsing
    // and repeat lookups are never throttled.
    const limit = await takeSearchToken(client);
    if (!limit.allowed) {
        console.log(`rate limited client=${client} retryAfter=${limit.retryAfterSeconds}`);
        return NextResponse.json({
            status: 'error',
            message: `Rate limit exceeded, retry after ${limit.retryAfterSeconds}s`,
        }, {
            status: 429,
            headers: {
                'Retry-After': String(limit.retryAfterSeconds),
                'RateLimit-Limit': String(SEARCH_BUCKET.refillPerDay),
                'RateLimit-Remaining': '0',
                'RateLimit-Reset': String(limit.retryAfterSeconds),
            },
        });
    }

    try {
        const books = await search(query);
        return NextResponse.json({
            status: 'ok',
            books
        });
    } catch (err) {
        console.error(`search threw an error:`, err);
        return NextResponse.json({
            status: 'error',
            message: (err as unknown as Error).message
        }, {status: 501});
    }
}
