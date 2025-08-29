import 'dotenv/config';
import { MissingPostBody, MissingResponse } from '../types/missing';
import { HardcoverQueryVariables, HardcoverContribution, queryHardcover } from './types/hardcover';
import { inspect } from 'node:util';

const HARDCOVER_TOKEN = process.env.HARDCOVER_TOKEN;
if (!HARDCOVER_TOKEN) {
  throw new Error('HARDCOVER_TOKEN is not set in the environment variables');
}
const HOST = process.env.IBDB_HOST || 'https://ibdb.dev';
const MISSING_POST_SECRET = process.env.MISSING_POST_SECRET;
if (!MISSING_POST_SECRET) {
  throw new Error('MISSING_POST_SECRET is not set in the environment variables');
}

async function loop(skip: number) {
    const missingResp = await fetch(`${HOST}/api/missing/hardcover?skip=${skip}`);
    if (!missingResp.ok) {
        throw new Error(`Failed to fetch missing hardcover IDs: ${missingResp.statusText}`);
    }
    const missingData = await missingResp.json() as MissingResponse;
    if (missingData.status !== 'ok') {
        throw new Error(`Error in missing data: ${missingData.message}`);
    }
    const missing = missingData.missing;
    const total = missingData.total;
    if (missing.length === 0) {
        console.log('No missing hardcover IDs to update.');
        return;
    }
    console.log(`Found ${missing.length} missing hardcover IDs to update.`);
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
        const hardcoverId = edition.id; // Assuming the ID is what you want to update
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
    return { total, updatedCount, length: missing.length};
}

async function main() {
    let skip = 0;
    if (process.argv.length > 2) {
        skip = parseInt(process.argv[2], 10);
        if (isNaN(skip) || skip < 0) {
            console.error('Invalid skip value. It should be a non-negative integer.');
            process.exit(1);
        }
        console.log(`Skipping the first ${skip} missing hardcover IDs.`);
    }
    let total = Number.MAX_SAFE_INTEGER;
    while (skip < total) {
        const result = await loop(skip);
        if (!result) {
            break;
        }
        total = result.total;
        const updatedCount = result.updatedCount;
        const length = result.length;
        skip += length - updatedCount;;
        console.log(`Next skip value: ${skip + length - updatedCount}; total: ${total}`);
    }
}

main().then(() => {
    console.log('Finished updating hardcover IDs.');
}).catch(err => {
    console.error('Error updating hardcover IDs:', err);
    process.exit(1);
});
