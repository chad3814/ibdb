/**
 * Works out which external ids a merge should move from the authors being
 * deleted onto the one being kept.
 *
 * Without this, merging drops them: the endpoint reassigns books and then
 * deletes the losing rows, so a hardcoverId, goodReadsId or openLibraryId held
 * only by a loser is gone. Those links cost third-party API quota to acquire.
 */

export type ExternalIdCarrier = {
    id: string;
    hardcoverId: number|null;
    hardcoverSlug: string|null;
    goodReadsId: string|null;
    openLibraryId: string|null;
};

export type DonatedIds = {
    hardcoverId?: number;
    hardcoverSlug?: string|null;
    goodReadsId?: string;
    openLibraryId?: string;
};

export function donatedExternalIds(
    target: ExternalIdCarrier,
    losers: ExternalIdCarrier[]
): DonatedIds {
    // Lowest id first, so several eligible donors resolve the same way on
    // every run regardless of the order the caller assembled them in.
    const ordered = [...losers].sort((a, b) => a.id.localeCompare(b.id));
    const donated: DonatedIds = {};

    if (target.hardcoverId === null) {
        // The slug is only meaningful alongside the id, so they move together.
        const donor = ordered.find(l => l.hardcoverId !== null);
        if (donor && donor.hardcoverId !== null) {
            donated.hardcoverId = donor.hardcoverId;
            donated.hardcoverSlug = donor.hardcoverSlug;
        }
    }

    if (target.goodReadsId === null) {
        const donor = ordered.find(l => l.goodReadsId !== null);
        if (donor && donor.goodReadsId !== null) {
            donated.goodReadsId = donor.goodReadsId;
        }
    }

    if (target.openLibraryId === null) {
        const donor = ordered.find(l => l.openLibraryId !== null);
        if (donor && donor.openLibraryId !== null) {
            donated.openLibraryId = donor.openLibraryId;
        }
    }

    return donated;
}
