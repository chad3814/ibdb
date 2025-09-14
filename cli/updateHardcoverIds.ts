import 'dotenv/config';
import { MissingPostBody, MissingResponse } from '../types/missing';
import { HardcoverQueryVariables, HardcoverContribution, queryHardcover } from './types/hardcover';

const HARDCOVER_TOKEN = process.env.HARDCOVER_TOKEN;
if (!HARDCOVER_TOKEN) {
  throw new Error('HARDCOVER_TOKEN is not set in the environment variables');
}
const HOST = process.env.IBDB_HOST || 'https://ibdb.dev';
const MISSING_POST_SECRET = process.env.MISSING_POST_SECRET;
if (!MISSING_POST_SECRET) {
  throw new Error('MISSING_POST_SECRET is not set in the environment variables');
}

async function loop(processingId?: string) {
    const url = processingId
        ? `${HOST}/api/missing/hardcover?previousProcessingId=${processingId}`
        : `${HOST}/api/missing/hardcover`;

    const missingResp = await fetch(url);
    if (!missingResp.ok) {
        throw new Error(`Failed to fetch missing hardcover IDs: ${missingResp.statusText}`);
    }
    const missingData = await missingResp.json() as MissingResponse;
    if (missingData.status !== 'ok') {
        throw new Error(`Error in missing data: ${missingData.message}`);
    }
    const missing = missingData.missing;
    const total = missingData.total;
    const newProcessingId = missingData.processingId;
    const remainingUnclaimed = missingData.remainingUnclaimed;
    if (missing.length === 0) {
        console.log('No missing hardcover IDs to update.');
        return { processingId: newProcessingId, updatedCount: 0, length: 0, remainingUnclaimed };
    }
    console.log(`Found ${missing.length} missing hardcover IDs to update. ${remainingUnclaimed} remaining in queue.`);
    let updatedCount = 0;
    for (const item of missing) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Throttle requests to avoid hitting API limits
        const { title, authors, isbn13: isbn } = item;
        const name = authors?.[0]?.name ?? '';
        const variables: HardcoverQueryVariables = {
            title,
            name,
            isbn
        };
        const {data} = await queryHardcover(variables, HARDCOVER_TOKEN!);

        const editions = data.editions;
        if (editions.length === 0) {
            // console.log(`No hardcover ID found for ${title} by ${name}`);
            continue;
        }
        const edition = editions[0];
        // const hardcoverId = edition.id; // Assuming the ID is what you want to update
        // console.log(`Updating hardcover ID for ${title} by ${name} to ${hardcoverId}`);
        // console.log(inspect(data, { depth: null, colors: true }));

        const updateData: MissingPostBody = {
            edition: {
                id: item.editionId,
                hardcoverId: edition.id,
            },
            book: {
                id: item.bookId,
                hardcoverId: edition.book.id,
                hardcoverSlug: edition.book.slug,
            },
            authors: item.authors.filter(
                author => edition.book.contributions.some(
                    (contributor: HardcoverContribution) => contributor.author.name === author.name
                )
            ).map(
                author => ({
                    id: author.id,
                    hardcoverId: edition.book.contributions.find(
                        (contributor: HardcoverContribution) => contributor.author.name === author.name
                    )?.author.id || null,
                    hardcoverSlug: edition.book.contributions.find(
                        (contributor: HardcoverContribution) => contributor.author.name === author.name
                    )?.author.slug || null,
                })
            ),
        };

        const updateResponse = await fetch(`${HOST}/api/missing/hardcover`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-secret': MISSING_POST_SECRET!,
            },
            body: JSON.stringify(updateData),
        });
        if (!updateResponse.ok) {
            console.error(`Failed to update hardcover ID for ${title}: ${updateResponse.statusText}`);
            continue;
        }
        const update = await updateResponse.json();
        if (update.status !== 'ok') {
            console.error(`Error updating hardcover ID for ${title}: ${update.message}`);
            continue;
        }
        console.log(`Successfully updated hardcover ID for ${title} by ${name}`);
        updatedCount++;
    }
    return { processingId: newProcessingId, updatedCount, length: missing.length, remainingUnclaimed };
}

async function main() {
    let processingId: string | undefined;

    // Support for processingId resumption from environment or file
    if (process.env.HARDCOVER_PROCESSING_ID) {
        processingId = process.env.HARDCOVER_PROCESSING_ID;
        console.log(`Resuming with processingId: ${processingId}`);
    }

    let continueProcessing = true;
    while (continueProcessing) {
        const result = await loop(processingId);
        if (!result) {
            break;
        }

        processingId = result.processingId;
        const { updatedCount, length, remainingUnclaimed } = result;

        console.log(`Processed batch: ${updatedCount}/${length} updated. ${remainingUnclaimed} books remaining in queue.`);

        if (length === 0 || remainingUnclaimed === 0) {
            console.log('No more books to process.');
            continueProcessing = false;
        }

        // Store processingId for potential resume
        if (processingId) {
            console.log(`Current processingId: ${processingId}`);
        }
    }
}

main().then(() => {
    console.log('Finished updating hardcover IDs.');
}).catch(err => {
    console.error('Error updating hardcover IDs:', err);
    process.exit(1);
});
