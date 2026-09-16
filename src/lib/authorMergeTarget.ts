import { scoreNameQuality } from './authorNameQuality';

/**
 * Chooses which of several duplicate author rows survives a merge.
 *
 * Every member of a cluster is the same name modulo case, punctuation and
 * whitespace, so no variant holds information another lacks. What differs is
 * what is attached to the row -- external ids and books -- and how the name is
 * typed. The cascade takes those in that order.
 */

export type MergeCandidate = {
    id: string;
    name: string;
    bookCount: number;
    hardcoverId: number|null;
    goodReadsId: string|null;
    openLibraryId: string|null;
    createdAt: Date;
};

export type TargetRule = 'external-ids'|'book-count'|'typography'|'age';

export type TargetOutcome =
    | { kind: 'chosen'; targetId: string; rule: TargetRule }
    | { kind: 'needs-review'; reason: string };

export function hasExternalIds(c: MergeCandidate): boolean {
    return c.hardcoverId !== null || c.goodReadsId !== null || c.openLibraryId !== null;
}

/**
 * The winners under one rung, or every member when the rung cannot separate
 * them. `id` breaks a true tie so the outcome never depends on input order.
 */
function bestBy(members: MergeCandidate[], rank: (c: MergeCandidate) => number): MergeCandidate[] {
    const top = Math.max(...members.map(rank));
    return members.filter(c => rank(c) === top);
}

export function pickMergeTarget(members: MergeCandidate[]): TargetOutcome {
    if (members.length < 2) {
        return { kind: 'needs-review', reason: `cluster has ${members.length} member(s), needs at least 2` };
    }

    const idHolders = members.filter(hasExternalIds);
    if (idHolders.length > 1) {
        // Picking one would discard a real link that cost quota to acquire.
        return {
            kind: 'needs-review',
            reason: `${idHolders.length} members hold external ids: ${idHolders.map(c => c.id).join(', ')}`,
        };
    }
    if (idHolders.length === 1) {
        return { kind: 'chosen', targetId: idHolders[0].id, rule: 'external-ids' };
    }

    const byBooks = bestBy(members, c => c.bookCount);
    if (byBooks.length === 1) {
        return { kind: 'chosen', targetId: byBooks[0].id, rule: 'book-count' };
    }

    const byQuality = bestBy(byBooks, c => scoreNameQuality(c.name));
    if (byQuality.length === 1) {
        return { kind: 'chosen', targetId: byQuality[0].id, rule: 'typography' };
    }

    // Oldest row wins, and id settles a shared timestamp, so a re-run cannot
    // pick differently.
    const oldest = [...byQuality].sort((a, b) => {
        const t = a.createdAt.getTime() - b.createdAt.getTime();
        return t !== 0 ? t : a.id.localeCompare(b.id);
    })[0];
    return { kind: 'chosen', targetId: oldest.id, rule: 'age' };
}
