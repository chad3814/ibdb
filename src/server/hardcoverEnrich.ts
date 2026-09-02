import { db } from './db';
import type { HardcoverEdition } from './hardcover';

export type QueueAuthor = {
    id: string;
    name: string;
};

export type QueueItem = {
    editionId: string;
    bookId: string;
    authors: QueueAuthor[];
};

export type EnrichedAuthor = {
    id: string;
    hardcoverId: number;
    hardcoverSlug: string;
};

export type Enrichment = {
    editionId: string;
    editionHardcoverId: number;
    bookId: string;
    bookHardcoverId: number;
    bookHardcoverSlug: string;
    authors: EnrichedAuthor[];
};

/**
 * Maps a Hardcover edition onto the ids we store.
 *
 * Authors are matched by exact name, so one of our authors is only ever given
 * the Hardcover id of a contributor with the same name -- an author Hardcover
 * does not list is left alone rather than guessed at.
 */
export function buildEnrichment(item: QueueItem, edition: HardcoverEdition): Enrichment {
    const contributions = edition.book.contributions ?? [];
    const authors: EnrichedAuthor[] = [];

    for (const author of item.authors) {
        const match = contributions.find(c => c.author.name === author.name);
        if (match) {
            authors.push({
                id: author.id,
                hardcoverId: match.author.id,
                hardcoverSlug: match.author.slug,
            });
        }
    }

    return {
        editionId: item.editionId,
        editionHardcoverId: edition.id,
        bookId: item.bookId,
        bookHardcoverId: edition.book.id,
        bookHardcoverSlug: edition.book.slug,
        authors,
    };
}

/**
 * Persists one enrichment and drops the book from the queue, atomically, so a
 * book is never dequeued without its ids being written.
 */
export async function applyEnrichment(enrichment: Enrichment): Promise<void> {
    await db.$transaction(async $tx => {
        await $tx.edition.update({
            where: { id: enrichment.editionId },
            data: { hardcoverId: enrichment.editionHardcoverId },
        });

        await $tx.book.update({
            where: { id: enrichment.bookId },
            data: {
                hardcoverId: enrichment.bookHardcoverId,
                hardcoverSlug: enrichment.bookHardcoverSlug,
            },
        });

        for (const author of enrichment.authors) {
            await $tx.author.update({
                where: { id: author.id },
                data: {
                    hardcoverId: author.hardcoverId,
                    hardcoverSlug: author.hardcoverSlug,
                },
            });
        }

        await $tx.hardcoverQueue.deleteMany({
            where: { bookId: enrichment.bookId },
        });
    }, {
        maxWait: 10_000,
        timeout: 20_000,
    });
}
