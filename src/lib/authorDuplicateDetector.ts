import { db, type Author } from '@/server/db';

// Types for duplicate detection
export interface AuthorSimilarity {
    author1: {
        id: string;
        name: string;
    };
    author2: {
        id: string;
        name: string;
    };
    score: number;
    matchReasons: {
        exactMatch?: boolean;
        nameFlipped?: boolean;  // "King, Stephen" vs "Stephen King"
        normalizedMatch?: boolean;
        fuzzyMatch?: number;
        phoneticMatch?: boolean;
        initialsMatch?: boolean;  // "J.K. Rowling" vs "Joanne Kathleen Rowling"
        missingMiddle?: boolean;  // "Stephen King" vs "Stephen Edwin King"
        sharedExternalIds?: string[];
    };
    confidence: 'exact' | 'high' | 'medium' | 'low';
}

export class AuthorDuplicateDetector {
    // Normalize author name for comparison
    private normalizeAuthorName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')         // Normalize whitespace
            .trim();
    }

    // Check if name is in "Last, First" format
    private isLastnameFirst(name: string): boolean {
        return name.includes(',');
    }

    // Flip "Last, First" to "First Last"
    private flipName(name: string): string {
        if (!this.isLastnameFirst(name)) return name;
        
        const parts = name.split(',').map(p => p.trim());
        if (parts.length === 2) {
            return `${parts[1]} ${parts[0]}`;
        }
        return name;
    }

    // Extract name components
    private parseAuthorName(name: string): {
        first?: string;
        middle?: string[];
        last?: string;
        normalized: string;
        flipped: string;
    } {
        const flipped = this.flipName(name);
        const normalized = this.normalizeAuthorName(flipped);
        const parts = flipped.split(/\s+/);
        
        if (parts.length === 1) {
            return { last: parts[0], normalized, flipped };
        } else if (parts.length === 2) {
            return { first: parts[0], last: parts[1], normalized, flipped };
        } else {
            return {
                first: parts[0],
                middle: parts.slice(1, -1),
                last: parts[parts.length - 1],
                normalized,
                flipped
            };
        }
    }

    // Calculate Levenshtein distance
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Calculate similarity percentage
    private calculateSimilarity(str1: string, str2: string): number {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 100;
        return Math.round((1 - distance / maxLength) * 100);
    }

    // Check if names are initials vs full names
    private checkInitialsMatch(name1: string, name2: string): boolean {
        const parts1 = name1.split(/\s+/);
        const parts2 = name2.split(/\s+/);
        
        // Must have same number of parts or very close
        if (Math.abs(parts1.length - parts2.length) > 1) {
            return false;
        }
        
        // Check if at least one name has initials
        const hasInitials1 = parts1.some(p => p.length <= 2 && (p.length === 1 || p[1] === '.'));
        const hasInitials2 = parts2.some(p => p.length <= 2 && (p.length === 1 || p[1] === '.'));
        
        if (!hasInitials1 && !hasInitials2) {
            return false; // Neither has initials
        }
        
        // Check if one uses initials and other uses full names
        // "J.K. Rowling" vs "Joanne Kathleen Rowling"
        let matchCount = 0;
        for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
            const p1 = parts1[i];
            const p2 = parts2[i];
            
            // Check if one is an initial of the other
            if (p1.length === 1 || (p1.length === 2 && p1[1] === '.')) {
                if (p2.toLowerCase().startsWith(p1[0].toLowerCase())) {
                    matchCount++;
                }
            } else if (p2.length === 1 || (p2.length === 2 && p2[1] === '.')) {
                if (p1.toLowerCase().startsWith(p2[0].toLowerCase())) {
                    matchCount++;
                }
            } else if (p1.toLowerCase() === p2.toLowerCase()) {
                matchCount++; // Exact match for non-initial parts
            }
        }
        
        // Must match at least 2 parts or all parts if less than 2
        return matchCount >= Math.min(2, Math.min(parts1.length, parts2.length));
    }

    // Compare two authors and calculate similarity
    public compareAuthors(author1: Author, author2: Author): AuthorSimilarity | null {
        const name1 = this.parseAuthorName(author1.name);
        const name2 = this.parseAuthorName(author2.name);
        
        const result: AuthorSimilarity = {
            author1: { id: author1.id, name: author1.name },
            author2: { id: author2.id, name: author2.name },
            score: 0,
            matchReasons: {},
            confidence: 'low'
        };

        // Check exact match (after normalization)
        if (name1.normalized === name2.normalized) {
            result.score = 100;
            result.matchReasons.exactMatch = true;
            result.confidence = 'exact';
            return result;
        }

        // Check if one is "Last, First" and other is "First Last"
        if (author1.name !== name1.flipped || author2.name !== name2.flipped) {
            if (name1.flipped.toLowerCase() === author2.name.toLowerCase() ||
                author1.name.toLowerCase() === name2.flipped.toLowerCase()) {
                result.score = 95;
                result.matchReasons.nameFlipped = true;
                result.confidence = 'high';
                return result;
            }
        }

        // Check fuzzy match
        const similarity = this.calculateSimilarity(name1.normalized, name2.normalized);
        if (similarity >= 85) {
            result.score = similarity;
            result.matchReasons.fuzzyMatch = similarity;
            result.confidence = similarity >= 90 ? 'high' : 'medium';
        }

        // Check initials match
        if (this.checkInitialsMatch(author1.name, author2.name)) {
            result.score = Math.max(result.score, 85);
            result.matchReasons.initialsMatch = true;
            result.confidence = 'high';
        }

        // Check missing middle name
        if (name1.last === name2.last && name1.first === name2.first) {
            if ((name1.middle?.length || 0) !== (name2.middle?.length || 0)) {
                result.score = Math.max(result.score, 90);
                result.matchReasons.missingMiddle = true;
                result.confidence = 'high';
            }
        }

        // Check shared external IDs
        const sharedIds: string[] = [];
        if (author1.goodReadsId && author1.goodReadsId === author2.goodReadsId) {
            sharedIds.push('goodreads');
        }
        if (author1.openLibraryId && author1.openLibraryId === author2.openLibraryId) {
            sharedIds.push('openlibrary');
        }
        if (author1.hardcoverId && author1.hardcoverId === author2.hardcoverId) {
            sharedIds.push('hardcover');
        }
        
        if (sharedIds.length > 0) {
            result.score = Math.max(result.score, 95);
            result.matchReasons.sharedExternalIds = sharedIds;
            result.confidence = 'high';
        }

        // Only return if score is above threshold
        return result.score >= 70 ? result : null;
    }

    // Find all potential duplicates for a given author
    public async findDuplicatesForAuthor(authorId: string): Promise<AuthorSimilarity[]> {
        const author = await db.author.findUnique({ where: { id: authorId } });
        if (!author) return [];

        // Get potential candidates (same first letter for efficiency)
        const firstLetter = author.name[0].toLowerCase();
        const candidates = await db.author.findMany({
            where: {
                AND: [
                    { id: { not: authorId } },
                    { name: { startsWith: firstLetter, mode: 'insensitive' } }
                ]
            }
        });

        const duplicates: AuthorSimilarity[] = [];
        for (const candidate of candidates) {
            const similarity = this.compareAuthors(author, candidate);
            if (similarity) {
                duplicates.push(similarity);
            }
        }

        // Sort by score descending
        return duplicates.sort((a, b) => b.score - a.score);
    }

    // Find all duplicates in the database (batch processing)
    public async findAllDuplicates(
        options: {
            minScore?: number;
            limit?: number;
            offset?: number;
            onProgress?: (current: number, total: number) => void;
        } = {}
    ): Promise<AuthorSimilarity[]> {
        const { minScore = 70, limit = 1000, offset = 0, onProgress } = options;
        
        const authors = await db.author.findMany({
            skip: offset,
            take: limit,
            orderBy: { name: 'asc' }
        });

        const duplicates: AuthorSimilarity[] = [];
        const processed = new Set<string>();

        for (let i = 0; i < authors.length; i++) {
            const author1 = authors[i];
            if (onProgress) {
                onProgress(i + 1, authors.length);
            }

            for (let j = i + 1; j < authors.length; j++) {
                const author2 = authors[j];
                const pairKey = [author1.id, author2.id].sort().join(':');
                
                if (processed.has(pairKey)) continue;
                processed.add(pairKey);

                const similarity = this.compareAuthors(author1, author2);
                if (similarity && similarity.score >= minScore) {
                    duplicates.push(similarity);
                }
            }
        }

        return duplicates.sort((a, b) => b.score - a.score);
    }

    // Quick scan for exact duplicates only
    public async findExactDuplicates(): Promise<Array<{
        name: string;
        authorIds: string[];
        count: number;
    }>> {
        const result = await db.$queryRaw<Array<{
            normalized: string;
            author_ids: string;
            count: bigint;
        }>>`
            SELECT 
                LOWER(TRIM(name)) as normalized,
                STRING_AGG(id, ',') as author_ids,
                COUNT(*) as count
            FROM "Author"
            GROUP BY normalized
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `;

        return result.map(row => ({
            name: row.normalized,
            authorIds: row.author_ids.split(','),
            count: Number(row.count)
        }));
    }

    // Find duplicates where names are flipped
    public async findFlippedNameDuplicates(): Promise<AuthorSimilarity[]> {
        // Find all authors with comma in name (likely "Last, First" format)
        const authorsWithComma = await db.author.findMany({
            where: { name: { contains: ',' } }
        });

        const duplicates: AuthorSimilarity[] = [];

        for (const author of authorsWithComma) {
            const flipped = this.flipName(author.name);
            
            // Look for exact match of flipped name
            const matches = await db.author.findMany({
                where: {
                    AND: [
                        { id: { not: author.id } },
                        { name: { equals: flipped, mode: 'insensitive' } }
                    ]
                }
            });

            for (const match of matches) {
                duplicates.push({
                    author1: { id: author.id, name: author.name },
                    author2: { id: match.id, name: match.name },
                    score: 95,
                    matchReasons: { nameFlipped: true },
                    confidence: 'high'
                });
            }
        }

        return duplicates;
    }
}

// Export singleton instance
export const duplicateDetector = new AuthorDuplicateDetector();