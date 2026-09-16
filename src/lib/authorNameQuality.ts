/**
 * Scores how well an author name is typed, so a merge can keep the
 * best-formatted spelling of a name.
 *
 * Only meaningful as a comparison between variants of the SAME name: every
 * pair this is used on is character-identical apart from case, punctuation and
 * whitespace, so there is no information to weigh -- only presentation.
 * Never compare the score against a threshold.
 */

/** Credentials and generational suffixes whose canonical form is not Title Case. */
const CANONICAL_SUFFIXES = new Map<string, string>([
    ['md', 'MD'],
    ['phd', 'PhD'],
    ['dds', 'DDS'],
    ['dvm', 'DVM'],
    ['rn', 'RN'],
    ['mba', 'MBA'],
    ['msw', 'MSW'],
    ['jd', 'JD'],
    ['jr', 'Jr'],
    ['sr', 'Sr'],
    ['ii', 'II'],
    ['iii', 'III'],
    ['iv', 'IV'],
]);

/** Surname prefixes that take an internal capital. */
const CELTIC_PREFIX = /\b(?:Mc|Mac|O'|D')([A-Z])/u;
const CELTIC_PREFIX_LOWER = /\b(?:Mc|Mac|O'|D')([a-z])/u;

function lettersOnly(name: string): string {
    return name.replace(/[^a-zA-Z]/gu, '');
}

/** Alphabetic tokens, stripped of surrounding punctuation. */
function alphaTokens(name: string): string[] {
    return name
        .split(/\s+/u)
        .map(t => t.replace(/[^a-zA-Z']/gu, ''))
        .filter(t => t.length > 0);
}

export function scoreNameQuality(name: string): number {
    let score = 0;
    const letters = lettersOnly(name);
    const tokens = alphaTokens(name);

    if (letters.length > 1) {
        if (letters === letters.toUpperCase()) {
            score -= 3;
        }
        if (letters === letters.toLowerCase()) {
            score -= 3;
        }
    }

    // Every alphabetic token starting with a capital. Deliberately does not
    // require the remainder to be lowercase: McCammon and O'Brien are correct.
    if (tokens.length > 0 && tokens.every(t => t[0] === t[0].toUpperCase())) {
        score += 2;
    }

    for (const token of tokens) {
        const canonical = CANONICAL_SUFFIXES.get(token.toLowerCase());
        if (canonical && token === canonical) {
            score += 2;
        }
    }

    if (CELTIC_PREFIX.test(name)) {
        score += 1;
    } else if (CELTIC_PREFIX_LOWER.test(name)) {
        score -= 1;
    }

    // Initials, i.e. single-letter tokens. Periods make them read as initials
    // rather than as a mangled name.
    const initials = name.split(/\s+/u).filter(t => /^[A-Za-z]\.?$/u.test(t));
    if (initials.length > 0 && initials.every(t => t.endsWith('.'))) {
        score += 1;
    }

    if (/\S\s{2,}\S/u.test(name)) {
        score -= 1;
    }

    // A trailing period is fine -- "Tolkien, J.R.R." ends in one legitimately.
    if (/[,;:&-]\s*$/u.test(name.trim())) {
        score -= 1;
    }

    return score;
}
