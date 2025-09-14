import type { AuthorDuplicate } from '@/hooks/useReviewFlow';

/**
 * Fetches the next pending duplicate pair for review
 * @param excludeId - Optional ID to exclude from results (current pair)
 * @returns The next duplicate pair or null if none available
 */
export async function fetchNextPendingDuplicate(
  excludeId?: string
): Promise<AuthorDuplicate | null> {
  try {
    const params = new URLSearchParams({
      status: 'pending',
      limit: '1',
      ...(excludeId && { exclude: excludeId })
    });

    const response = await fetch(`/api/admin/duplicates?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch duplicates: ${response.statusText}`);
    }

    const data = await response.json();

    // Return first duplicate or null if none
    return data.duplicates && data.duplicates.length > 0
      ? data.duplicates[0]
      : null;
  } catch (error) {
    console.error('Error fetching next duplicate:', error);
    throw error;
  }
}

/**
 * Executes a merge operation for duplicate authors
 * @param duplicate - The duplicate pair to merge
 * @param targetAuthorId - The ID of the author to keep
 * @returns Success response or throws error
 */
export async function executeMerge(
  duplicate: AuthorDuplicate,
  targetAuthorId: string
): Promise<{ status: string; booksReassigned: number }> {
  try {
    const response = await fetch('/api/admin/duplicates/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authorIds: [duplicate.author1Id, duplicate.author2Id],
        targetAuthorId,
        mergeReason: `Continuous review: ${duplicate.score}% match`,
        similarityIds: [duplicate.id]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Merge failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Merge failed');
    }

    return data;
  } catch (error) {
    console.error('Error executing merge:', error);
    throw error;
  }
}

/**
 * Updates the status of a duplicate pair
 * @param id - The duplicate pair ID
 * @param status - The new status
 * @param notes - Optional notes for the status update
 * @returns Success response or throws error
 */
export async function updateDuplicateStatus(
  id: string,
  status: 'dismissed' | 'reviewed' | 'skipped',
  notes?: string
): Promise<void> {
  try {
    const response = await fetch('/api/admin/duplicates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, notes })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Status update failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating duplicate status:', error);
    throw error;
  }
}

/**
 * Batch fetches multiple pending duplicates for preloading
 * @param limit - Number of duplicates to fetch
 * @param excludeIds - IDs to exclude from results
 * @returns Array of duplicate pairs
 */
export async function fetchPendingDuplicatesBatch(
  limit: number = 5,
  excludeIds: string[] = []
): Promise<AuthorDuplicate[]> {
  try {
    const params = new URLSearchParams({
      status: 'pending',
      limit: limit.toString(),
      ...(excludeIds.length > 0 && { exclude: excludeIds.join(',') })
    });

    const response = await fetch(`/api/admin/duplicates?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch duplicates: ${response.statusText}`);
    }

    const data = await response.json();
    return data.duplicates || [];
  } catch (error) {
    console.error('Error fetching duplicate batch:', error);
    throw error;
  }
}