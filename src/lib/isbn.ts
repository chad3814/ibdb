const SEPARATORS = /[\s-]/gu;
const THIRTEEN_DIGITS = /^[0-9]{13}$/u;

/** Strips the hyphens and spaces ISBNs are commonly written with. */
export function normalizeIsbn13(isbn: string): string {
    return isbn.replaceAll(SEPARATORS, '');
}

/**
 * True when `isbn` could be an ISBN-13 at all.
 *
 * Only the shape is checked, not the check digit: ISBNdb holds records whose
 * check digits do not validate, and rejecting those would lose real books. The
 * point here is to refuse input that could never be an ISBN — a crawler walking
 * `/isbn/<anything>` should not cost an API request per URL.
 */
export function isPossibleIsbn13(isbn: string): boolean {
    return THIRTEEN_DIGITS.test(normalizeIsbn13(isbn));
}
