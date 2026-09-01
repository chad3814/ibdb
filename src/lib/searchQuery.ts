// Keeps letters, numbers and combining marks of any script, dropping only
// punctuation and symbols. Two things this guards against:
//
//   - [^a-zA-Z0-9 ] deleted every non-ASCII letter, so "Psychologie der
//     Persönlichkeit" went to ISBNdb as "psychologie der perso nlichkeit".
//   - \p{L} alone is not enough. Combining marks are category M, not L, so
//     decomposed (NFD) text would still lose its accents. The Calibre plugin
//     these searches come from sends NFD, which is why the mangled query in
//     the logs kept its "o" and lost only the diaeresis.
const UNCLEAN = /[^\p{L}\p{N}\p{M} ]/gu;
const RUNS_OF_SPACE = /\s+/gu;

/**
 * Normalizes a raw user query into the canonical key used for the BookQuery
 * cache. Text is composed to NFC, punctuation becomes whitespace, runs of
 * whitespace collapse to a single space, and the result is trimmed and
 * lowercased.
 *
 * NFC composition means the same title spelled decomposed or precomposed
 * shares one cache key instead of costing two ISBNdb requests. Collapsing and
 * trimming matter for the same reason: without them `"The Hobbit!"` and
 * `"The Hobbit"` are different keys. Returns `''` for a query that is nothing
 * but punctuation, which callers must treat as "no query" rather than search.
 */
export function cleanQuery(query: string): string {
    return query
        .normalize('NFC')
        .replaceAll(UNCLEAN, ' ')
        .replaceAll(RUNS_OF_SPACE, ' ')
        .trim()
        .toLowerCase();
}
