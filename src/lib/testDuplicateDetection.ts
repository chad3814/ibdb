#!/usr/bin/env node

import { AuthorDuplicateDetector } from './authorDuplicateDetector';

// Test cases for duplicate detection
const testAuthors = [
    // Exact duplicates (different casing/spacing)
    { id: '1', name: 'Stephen King', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '2', name: 'stephen king', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '3', name: 'Stephen  King', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Lastname, Firstname format
    { id: '4', name: 'King, Stephen', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '5', name: 'Tolkien, J.R.R.', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '6', name: 'J.R.R. Tolkien', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Initials vs full names
    { id: '7', name: 'J.K. Rowling', goodReadsId: '1077326', openLibraryId: null, hardcoverId: null },
    { id: '8', name: 'Joanne Kathleen Rowling', goodReadsId: '1077326', openLibraryId: null, hardcoverId: null },
    { id: '9', name: 'J K Rowling', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Missing middle names
    { id: '10', name: 'Stephen Edwin King', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '11', name: 'George R.R. Martin', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '12', name: 'George R. R. Martin', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '13', name: 'George Martin', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Typos and variations
    { id: '14', name: 'Steven King', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '15', name: 'J.R.R Tolkien', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Different authors (should not match)
    { id: '16', name: 'Martin George', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '17', name: 'Stephen Hawking', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '18', name: 'George Orwell', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Edge cases
    { id: '19', name: 'Lee, Harper', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '20', name: 'Harper Lee', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '21', name: 'Léon, Donna', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '22', name: 'Donna Leon', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    
    // Complex names
    { id: '23', name: 'Gabriel García Márquez', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '24', name: 'Garcia Marquez, Gabriel', goodReadsId: null, openLibraryId: null, hardcoverId: null },
    { id: '25', name: 'Gabriel Garcia Marquez', goodReadsId: null, openLibraryId: null, hardcoverId: null },
];

function runTests() {
    const detector = new AuthorDuplicateDetector();
    
    console.log('🧪 Testing Author Duplicate Detection Algorithm\n');
    console.log('=' .repeat(80));
    
    const allDuplicates: any[] = [];
    const expectedMatches = new Map<string, string[]>([
        ['Stephen King', ['1', '2', '3', '4', '10', '14']],
        ['J.R.R. Tolkien', ['5', '6', '15']],
        ['J.K. Rowling', ['7', '8', '9']],
        ['George R.R. Martin', ['11', '12', '13']],
        ['Harper Lee', ['19', '20']],
        ['Donna Leon', ['21', '22']],
        ['Gabriel García Márquez', ['23', '24', '25']],
    ]);
    
    // Test all pairs
    for (let i = 0; i < testAuthors.length; i++) {
        for (let j = i + 1; j < testAuthors.length; j++) {
            const author1 = testAuthors[i];
            const author2 = testAuthors[j];
            const result = detector.compareAuthors(author1 as any, author2 as any);
            
            if (result && result.score >= 70) {
                allDuplicates.push(result);
            }
        }
    }
    
    // Sort by score
    allDuplicates.sort((a, b) => b.score - a.score);
    
    // Display results grouped by confidence
    const groupedResults = {
        exact: allDuplicates.filter(d => d.confidence === 'exact'),
        high: allDuplicates.filter(d => d.confidence === 'high'),
        medium: allDuplicates.filter(d => d.confidence === 'medium'),
        low: allDuplicates.filter(d => d.confidence === 'low'),
    };
    
    console.log('\n📊 DETECTION RESULTS\n');
    
    for (const [confidence, results] of Object.entries(groupedResults)) {
        if (results.length === 0) continue;
        
        console.log(`\n${confidence.toUpperCase()} CONFIDENCE (${results.length} pairs):`);
        console.log('-'.repeat(60));
        
        for (const result of results) {
            console.log(`\n  "${result.author1.name}" ↔ "${result.author2.name}"`);
            console.log(`  Score: ${result.score}%`);
            console.log(`  Reasons:`, result.matchReasons);
        }
    }
    
    // Summary statistics
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 SUMMARY STATISTICS\n');
    console.log(`Total test authors: ${testAuthors.length}`);
    console.log(`Duplicate pairs found: ${allDuplicates.length}`);
    console.log(`  - Exact matches: ${groupedResults.exact.length}`);
    console.log(`  - High confidence: ${groupedResults.high.length}`);
    console.log(`  - Medium confidence: ${groupedResults.medium.length}`);
    console.log(`  - Low confidence: ${groupedResults.low.length}`);
    
    // Test specific patterns
    console.log('\n🎯 PATTERN DETECTION TESTS\n');
    console.log('-'.repeat(60));
    
    // Test "Lastname, Firstname" detection
    const flippedPairs = allDuplicates.filter(d => d.matchReasons.nameFlipped);
    console.log(`\n✓ "Lastname, Firstname" patterns detected: ${flippedPairs.length}`);
    for (const pair of flippedPairs) {
        console.log(`  - "${pair.author1.name}" ↔ "${pair.author2.name}"`);
    }
    
    // Test initials matching
    const initialsPairs = allDuplicates.filter(d => d.matchReasons.initialsMatch);
    console.log(`\n✓ Initials vs full names detected: ${initialsPairs.length}`);
    for (const pair of initialsPairs) {
        console.log(`  - "${pair.author1.name}" ↔ "${pair.author2.name}"`);
    }
    
    // Test missing middle names
    const missingMiddle = allDuplicates.filter(d => d.matchReasons.missingMiddle);
    console.log(`\n✓ Missing middle names detected: ${missingMiddle.length}`);
    for (const pair of missingMiddle) {
        console.log(`  - "${pair.author1.name}" ↔ "${pair.author2.name}"`);
    }
    
    // Performance estimate for 300k authors
    console.log('\n' + '='.repeat(80));
    console.log('\n⚡ PERFORMANCE ESTIMATES FOR 300K AUTHORS\n');
    
    const authorsCount = 300000;
    const blocksCount = 26; // Alphabetic blocking
    const avgBlockSize = authorsCount / blocksCount;
    const comparisonsPerBlock = (avgBlockSize * (avgBlockSize - 1)) / 2;
    const totalComparisons = comparisonsPerBlock * blocksCount;
    const naiveComparisons = (authorsCount * (authorsCount - 1)) / 2;
    
    console.log(`Naive approach: ${(naiveComparisons / 1e9).toFixed(1)}B comparisons`);
    console.log(`With blocking: ${(totalComparisons / 1e9).toFixed(1)}B comparisons`);
    console.log(`Reduction: ${((1 - totalComparisons / naiveComparisons) * 100).toFixed(1)}%`);
    console.log(`\nEstimated processing time:`);
    console.log(`  - Exact matches: < 1 second`);
    console.log(`  - Flipped names: ~5 seconds`);
    console.log(`  - Full scan with blocking: ~10-15 minutes`);
    console.log(`  - Without blocking: ~2-3 hours`);
}

// Run tests
runTests();