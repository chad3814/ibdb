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
    ['v', 'V'],
    ['vi', 'VI'],
    ['vii', 'VII'],
    ['viii', 'VIII'],
    ['mfa', 'MFA'],
    ['cpa', 'CPA'],
    ['lcsw', 'LCSW'],
    ['esq', 'Esq'],
]);

/**
 * Nobiliary and toponymic particles. Convention lowercases these mid-name --
 * `van Gelder`, `von Tischendorf`, `da Silva`, `de la Boetie` -- but the
 * title-case bonus below rewards capitalizing every token, so without this
 * the mangled form wins. A production dry run had 45 clusters turning on it.
 */
const PARTICLES = new Set([
    'van', 'von', 'der', 'den', 'de', 'del', 'della', 'da', 'das', 'dos',
    'di', 'du', 'ter', 'ten', 'zu', 'le', 'la', 'lo',
]);

/**
 * An unspaced run of two or more capitalized initials, each followed by a
 * period: "C.S.", "J.R.R.", "P.D.". Uppercase-only is deliberate: it makes
 * "P.D." score above "P.d.", and "C.S." above "C.s.".
 */
const UNSPACED_INITIAL_RUN = /^(?:[A-Z]\.){2,}$/u;

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

/**
 * Whitespace-delimited tokens paired with their alphabetic form (stripped of
 * surrounding punctuation). Kept as pairs -- rather than two separately
 * filtered arrays -- so a given index's raw and alpha forms can never drift
 * apart, e.g. when deciding whether "C.S." earned its ALL-CAPS look from
 * real initials rather than from shouting.
 */
function alphaTokenPairs(name: string): { raw: string; alpha: string }[] {
    return name
        .split(/\s+/u)
        .map(raw => ({ raw, alpha: raw.replace(/[^a-zA-Z']/gu, '') }))
        .filter(pair => pair.alpha.length > 0);
}

export function scoreNameQuality(name: string): number {
    let score = 0;
    const letters = lettersOnly(name);
    const tokenPairs = alphaTokenPairs(name);
    const tokens = tokenPairs.map(pair => pair.alpha);

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
    //
    // A raw token containing a period is exempt: alphaTokenPairs discards
    // periods to build `alpha`, so "C.S." (raw) becomes "CS" (alpha) -- an
    // all-caps token that never shouted, it's just initials without spaces.
    // A leading "MD" has no period and stays penalized on purpose: "Md" is
    // the standard abbreviation of Muhammad and a common leading given
    // name, not a credential, when it is the first token (see
    // isCanonicalSuffixToken).
    for (let i = 0; i < tokenPairs.length; i++) {
        const { raw, alpha: token } = tokenPairs[i];
        if (token.length > 1
            && token === token.toUpperCase()
            && !isCanonicalSuffixToken(token, i)
            && !raw.includes('.')) {
            score -= 2;
        }
    }

    // A token is an internal particle -- a nobiliary/toponymic particle
    // (see PARTICLES) that is neither the first nor the last token -- when
    // its index falls strictly inside the name. A leading particle is a
    // legitimate surname-first capital ("Van Gogh" as a listing, "De La
    // Cruz, Melissa"), and a trailing one is not a particle at all.
    const isInternalParticle = (token: string, index: number): boolean =>
        index >= 1 && index <= tokens.length - 2 && PARTICLES.has(token.toLowerCase());

    // Every alphabetic token starting with a capital, except an internal
    // particle, which is conventionally lowercased mid-name and scored on
    // its own casing below. Deliberately does not require the remainder to
    // be lowercase: McCammon and O'Brien are correct.
    if (tokens.length > 0
        && tokens.every((t, i) => isInternalParticle(t, i) || t[0] === t[0].toUpperCase())) {
        score += 2;
    }

    // An internal particle's own casing: lowercase is the convention
    // ("van Gelder"), so reward it; a capitalized one is the mistake this
    // rule exists to stop rewarding via the title-case bonus above.
    for (let i = 1; i <= tokens.length - 2; i++) {
        const token = tokens[i];
        if (!PARTICLES.has(token.toLowerCase())) {
            continue;
        }
        if (token === token.toLowerCase()) {
            score += 1;
        } else if (token[0] === token[0].toUpperCase()) {
            score -= 1;
        }
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

    // An unspaced initial run, e.g. "C.S." or "J.R.R.", is initials typed
    // without spaces rather than a mangled name -- reward it the same way
    // spaced initials are rewarded above. This never fires alongside the
    // spaced-initials bonus above: "C.S." and "J.R.R." are each one token,
    // so they never appear in `initials` (which only holds single-letter
    // tokens), and "J. R. R." never matches UNSPACED_INITIAL_RUN (which
    // needs 2+ letter-period pairs inside one token).
    //
    // A single trailing period on the whole name is ignored here, mirroring
    // the trailing-separator check below: "Tolkien J.R.R." must not out-
    // score "Tolkien J.R.R" simply because its final initial happens to
    // land at the very end of the string.
    const wordsForInitialRun = name.trim().replace(/\.$/u, '').split(/\s+/u);
    if (wordsForInitialRun.some(t => UNSPACED_INITIAL_RUN.test(t))) {
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
