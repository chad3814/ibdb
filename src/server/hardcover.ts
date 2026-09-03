// Client and types for the Hardcover GraphQL API.
//
// Lifted out of cli/types/hardcover.ts so the cron worker and the CLI share one
// implementation; that file now re-exports from here.

export interface HardcoverAuthor {
    id: number;
    name: string;
    slug: string;
}

export interface HardcoverContribution {
    author: HardcoverAuthor;
}

export interface HardcoverBook {
    id: number;
    title: string;
    slug: string;
    contributions: HardcoverContribution[];
}

export interface HardcoverEdition {
    id: number;
    isbn_13: string;
    book: HardcoverBook;
}

export interface HardcoverQueryVariables {
    title?: string;
    name?: string;
    isbn?: string;
}

export interface HardcoverQueryResponse {
    data: {
        editions?: HardcoverEdition[];
    };
    errors?: Array<{
        message: string;
        extensions?: Record<string, unknown>;
    }>;
}

export type RateLimitState = {
    remaining: number;
    resetSeconds: number;
};

/** The edition to enrich from, or null when there is nothing usable. */
export function selectEdition(response: HardcoverQueryResponse): HardcoverEdition|null {
    if (response?.errors?.length) {
        return null;
    }
    return response?.data?.editions?.[0] ?? null;
}

const IETF_RATE_LIMIT = /(?:^|;)\s*r=(\d+)\s*;\s*t=(\d+)/u;

/**
 * Reads Hardcover's rate limit headers so the worker can pace itself instead of
 * waiting to be 429'd. Returns null when the headers are absent or unparseable,
 * which callers must treat as "no information" and fall back to fixed pacing --
 * never as "there is headroom".
 */
export function parseRateLimit(headers: Headers): RateLimitState|null {
    const ietf = headers.get('ratelimit');
    if (ietf) {
        const match = IETF_RATE_LIMIT.exec(ietf);
        if (match) {
            return { remaining: Number(match[1]), resetSeconds: Number(match[2]) };
        }
    }

    const remaining = Number(headers.get('x-ratelimit-remaining'));
    const resetSeconds = Number(headers.get('x-ratelimit-reset'));
    if (headers.has('x-ratelimit-remaining') && headers.has('x-ratelimit-reset')
        && Number.isFinite(remaining) && Number.isFinite(resetSeconds)) {
        return { remaining, resetSeconds };
    }

    return null;
}

const EDITION_FIELDS = `
    id
    isbn_13
    book {
        id
        title
        slug
        contributions {
            author {
                id
                name
                slug
            }
        }
    }
`;

/**
 * Match on ISBN-13 alone. It uniquely identifies an edition, so adding a title
 * or author equality on top can only throw away correct matches -- which is
 * what the original combined query did, matching under 1% of the queue.
 */
const ISBN_QUERY = `
    query ByIsbn($isbn: String) {
        editions(where: {
            isbn_13: {_eq: $isbn},
            edition_format: {_is_null: false}
        }) {${EDITION_FIELDS}}
    }
`;

/** The original conjunction, kept so cli/updateHardcoverIds.ts is unchanged. */
const COMBINED_QUERY = `
    query MyQuery($title: String, $name: String, $isbn: String) {
        editions(where: {
            title: {_eq: $title},
            edition_format: {_is_null: false},
            contributions: {author: {name: {_eq: $name}}},
            isbn_13: {_eq: $isbn}
        }) {${EDITION_FIELDS}}
    }
`;

export type HardcoverResult = {
    response: HardcoverQueryResponse;
    rateLimit: RateLimitState|null;
};

export class HardcoverRateLimitedError extends Error {
    constructor(public readonly resetSeconds: number|null) {
        super('Hardcover rate limit exceeded');
        this.name = 'HardcoverRateLimitedError';
    }
}

async function execute(
    query: string,
    variables: Record<string, string|undefined>,
    token: string,
    signal?: AbortSignal
): Promise<HardcoverResult> {
    const response = await fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal,
    });

    const rateLimit = parseRateLimit(response.headers);

    if (response.status === 429) {
        throw new HardcoverRateLimitedError(rateLimit?.resetSeconds ?? null);
    }

    if (!response.ok) {
        throw new Error(`Hardcover API request failed: ${response.status} ${response.statusText}`);
    }

    return {
        response: await response.json() as HardcoverQueryResponse,
        rateLimit,
    };
}

export function queryHardcoverByIsbn(
    isbn: string,
    token: string,
    signal?: AbortSignal
): Promise<HardcoverResult> {
    return execute(ISBN_QUERY, { isbn }, token, signal);
}

export function queryHardcover(
    variables: HardcoverQueryVariables,
    token: string,
    signal?: AbortSignal
): Promise<HardcoverResult> {
    return execute(COMBINED_QUERY, { ...variables }, token, signal);
}
