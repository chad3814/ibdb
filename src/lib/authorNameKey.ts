/**
 * The normalized form two author names must share to be the same name.
 *
 * Lifted out of AuthorDuplicateDetector, which used a private copy, so the
 * merge script's cluster assertion cannot drift from what the detector
 * actually meant by `exactMatch`.
 */

/** Whether a name looks like "Last, First". */
function isLastnameFirst(name: string): boolean {
    return name.includes(',');
}

/**
 * Turns "Last, First" into "First Last".
 *
 * Only a name with exactly two comma-separated parts is flipped. "Smith, John,
 * Jr" has three, and guessing which part is the surname would corrupt it.
 */
export function flipLastnameFirst(name: string): string {
    if (!isLastnameFirst(name)) {
        return name;
    }

    const parts = name.split(',').map(p => p.trim());
    if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`;
    }
    return name;
}

/**
 * Whitespace is collapsed, not removed. Removing it would make
 * "Jo Ann Smith" and "Joann Smith" the same key, which the detector never
 * treated as a match -- clustering on that would merge two different people.
 */
export function authorNameKey(name: string): string {
    return flipLastnameFirst(name)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
