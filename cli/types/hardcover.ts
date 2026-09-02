// Re-exported so the CLI and the cron worker share one Hardcover client.
// The implementation lives in src/server/hardcover.ts.
export type {
    HardcoverAuthor,
    HardcoverContribution,
    HardcoverBook,
    HardcoverEdition,
    HardcoverQueryVariables,
    HardcoverQueryResponse,
    RateLimitState,
} from '../../src/server/hardcover';

export {
    selectEdition,
    parseRateLimit,
    HardcoverRateLimitedError,
} from '../../src/server/hardcover';

import { queryHardcover as query } from '../../src/server/hardcover';
import type { HardcoverQueryVariables, HardcoverQueryResponse } from '../../src/server/hardcover';

/**
 * Kept returning the bare response body so cli/updateHardcoverIds.ts, which
 * predates rate limit handling, works unchanged.
 */
export async function queryHardcover(
    variables: HardcoverQueryVariables,
    token: string
): Promise<HardcoverQueryResponse> {
    const { response } = await query(variables, token);
    return response;
}
