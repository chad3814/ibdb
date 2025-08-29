#!/usr/bin/env node

import 'dotenv/config';
import { queryHardcover, HardcoverQueryVariables } from '../types/hardcover';

const HARDCOVER_TOKEN = process.env.HARDCOVER_TOKEN;

if (!HARDCOVER_TOKEN) {
    console.error('HARDCOVER_TOKEN is not set in the environment variables');
    process.exit(1);
}

async function example() {
    // Example 1: Search by title, author name, and ISBN
    const variables1: HardcoverQueryVariables = {
        title: "The Hobbit",
        name: "J.R.R. Tolkien",
        isbn: "9780547928227"
    };

    try {
        console.log('Querying Hardcover API with:', variables1);
        const response1 = await queryHardcover(variables1, HARDCOVER_TOKEN!);
        
        if (response1.errors) {
            console.error('GraphQL Errors:', response1.errors);
        } else {
            console.log(`Found ${response1.data.editions.length} editions`);
            
            for (const edition of response1.data.editions) {
                console.log('\nEdition:');
                console.log(`  ID: ${edition.id}`);
                console.log(`  ISBN-13: ${edition.isbn_13}`);
                console.log(`  Book ID: ${edition.book.id}`);
                console.log(`  Book Title: ${edition.book.title}`);
                console.log(`  Book Slug: ${edition.book.slug}`);
                console.log(`  Authors:`);
                
                for (const contribution of edition.book.contributions) {
                    console.log(`    - ${contribution.author.name} (ID: ${contribution.author.id}, Slug: ${contribution.author.slug})`);
                }
            }
        }
    } catch (error) {
        console.error('Error querying Hardcover API:', error);
    }

    // Example 2: Search by ISBN only
    const variables2: HardcoverQueryVariables = {
        isbn: "9780547928227"
    };

    try {
        console.log('\n---\nQuerying with ISBN only:', variables2);
        const response2 = await queryHardcover(variables2, HARDCOVER_TOKEN!);
        console.log(`Found ${response2.data.editions.length} editions by ISBN`);
    } catch (error) {
        console.error('Error querying by ISBN:', error);
    }

    // Example 3: Search by title and author only
    const variables3: HardcoverQueryVariables = {
        title: "The Hobbit",
        name: "J.R.R. Tolkien"
    };

    try {
        console.log('\n---\nQuerying with title and author:', variables3);
        const response3 = await queryHardcover(variables3, HARDCOVER_TOKEN!);
        console.log(`Found ${response3.data.editions.length} editions by title and author`);
    } catch (error) {
        console.error('Error querying by title and author:', error);
    }
}

// Run the example
example().catch(console.error);