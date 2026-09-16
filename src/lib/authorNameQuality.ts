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

/**
 * Whether `token` is a known credential/suffix, appearing in its canonical
 * form, at a position where a credential can occur.
 *
 * Index 0 is deliberately excluded: "Md" is the standard abbreviation of
 * Muhammad and a common leading given name, not a credential, when it is
 * the first token. A trailing "Md" is always the credential. Both the
 * suffix bonus and the ALL-CAPS penalty exemption below share this check,
 * so a leading "MD" is never treated as an immune credential by either.
 */
function isCanonicalSuffixToken(token: string, index: number): boolean {
    return index >= 1 && CANONICAL_SUFFIXES.get(token.toLowerCase()) === token;
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

    // A single shouty token is the common case in book metadata, and the
    // whole-name check above cannot see it. Credentials are legitimately
    // uppercase, and single letters are initials.
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.length > 1
            && token === token.toUpperCase()
            && !isCanonicalSuffixToken(token, i)) {
            score -= 2;
        }
    }

    // Every alphabetic token starting with a capital. Deliberately does not
    // require the remainder to be lowercase: McCammon and O'Brien are correct.
    if (tokens.length > 0 && tokens.every(t => t[0] === t[0].toUpperCase())) {
        score += 2;
    }

    for (let i = 1; i < tokens.length; i++) {
        if (isCanonicalSuffixToken(tokens[i], i)) {
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
