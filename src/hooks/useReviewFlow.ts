import { useState, useCallback, useRef } from 'react';
import { fetchNextPendingDuplicate } from '@/lib/duplicateReviewApi';

// Types
export interface AuthorDuplicate {
  id: string;
  author1Id: string;
  author1Name: string;
  author2Id: string;
  author2Name: string;
  score: number;
  confidence: string;
  matchReasons: {
    exactMatch?: boolean;
    nameFlipped?: boolean;
    normalizedMatch?: boolean;
    fuzzyMatch?: number;
    phoneticMatch?: boolean;
    initialsMatch?: boolean;
    missingMiddle?: boolean;
    sharedExternalIds?: string[];
  };
  status: string;
  author1: {
    id: string;
    name: string;
    books: Array<{ id: string; title: string }>;
    deleted?: boolean;
  };
  author2: {
    id: string;
    name: string;
    books: Array<{ id: string; title: string }>;
    deleted?: boolean;
  };
}

export type OperationType = 'merge' | 'dismiss' | 'reviewed' | 'skip';

export interface QueuedOperation {
  id: string;
  type: OperationType;
  duplicate: AuthorDuplicate;
  targetAuthorId?: string;
  timestamp: number;
  status: 'pending' | 'executed' | 'cancelled';
}

interface UseReviewFlowState {
  currentPair: AuthorDuplicate | null;
  previousPair: AuthorDuplicate | null;
  isLoading: boolean;
  isComplete: boolean;
  canGoBack: boolean;
  error: string | null;
}

interface UseReviewFlowActions {
  selectAuthor: (targetAuthorId: string) => Promise<void>;
  skip: () => Promise<void>;
  markNotDuplicates: () => Promise<void>;
  markReviewed: () => Promise<void>;
  goBack: () => void;
  loadInitialPair: () => Promise<void>;
  closeModal: () => Promise<void>;
}

export interface UseReviewFlowReturn extends UseReviewFlowState, UseReviewFlowActions {
  queuedOperation: QueuedOperation | null;
}

export function useReviewFlow(): UseReviewFlowReturn {
  // State
  const [currentPair, setCurrentPair] = useState<AuthorDuplicate | null>(null);
  const [previousPair, setPreviousPair] = useState<AuthorDuplicate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedOperation, setQueuedOperation] = useState<QueuedOperation | null>(null);

  // Refs for managing timers and cleanup
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const operationIdCounter = useRef(0);

  // Computed values
  const canGoBack = Boolean(
    previousPair &&
    queuedOperation &&
    queuedOperation.status === 'pending'
  );

  // Clear queue timer
  const clearQueueTimer = useCallback(() => {
    if (queueTimerRef.current) {
      clearTimeout(queueTimerRef.current);
      queueTimerRef.current = null;
    }
  }, []);

  // Queue an operation for delayed execution
  const queueOperation = useCallback((
    type: OperationType,
    duplicate: AuthorDuplicate,
    targetAuthorId?: string
  ) => {
    clearQueueTimer();

    const operation: QueuedOperation = {
      id: `op-${++operationIdCounter.current}`,
      type,
      duplicate,
      targetAuthorId,
      timestamp: Date.now(),
      status: 'pending'
    };

    setQueuedOperation(operation);

    // Set timer for execution (2 seconds)
    queueTimerRef.current = setTimeout(() => {
      setQueuedOperation(prev =>
        prev && prev.id === operation.id
          ? { ...prev, status: 'executed' }
          : prev
      );
    }, 2000);

    return operation;
  }, [clearQueueTimer]);

  // Cancel the queued operation
  const cancelQueuedOperation = useCallback(() => {
    clearQueueTimer();
    if (queuedOperation && queuedOperation.status === 'pending') {
      setQueuedOperation(prev =>
        prev ? { ...prev, status: 'cancelled' } : null
      );
    }
  }, [queuedOperation, clearQueueTimer]);

  // Load initial pair
  const loadInitialPair = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // This will be connected to the API helper
      const pair = await fetchNextPendingDuplicate();
      if (pair) {
        setCurrentPair(pair);
        setPreviousPair(null);
        setIsComplete(false);
      } else {
        setIsComplete(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicate');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Advance to next pair
  const advanceToNext = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Store current as previous
    if (currentPair) {
      setPreviousPair(currentPair);
    }

    try {
      const nextPair = await fetchNextPendingDuplicate(currentPair?.id);
      if (nextPair) {
        setCurrentPair(nextPair);
      } else {
        setIsComplete(true);
        setCurrentPair(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load next duplicate');
    } finally {
      setIsLoading(false);
    }
  }, [currentPair]);

  // Action: Select author for merge
  const selectAuthor = useCallback(async (targetAuthorId: string) => {
    if (!currentPair) return;

    // Clear any previous operation
    cancelQueuedOperation();

    // Queue the merge operation
    queueOperation('merge', currentPair, targetAuthorId);

    // Advance to next
    await advanceToNext();
  }, [currentPair, cancelQueuedOperation, queueOperation, advanceToNext]);

  // Action: Skip
  const skip = useCallback(async () => {
    if (!currentPair) return;

    // Skip doesn't need queue (no undo)
    cancelQueuedOperation();
    setPreviousPair(null); // Can't undo a skip

    await advanceToNext();
  }, [currentPair, cancelQueuedOperation, advanceToNext]);

  // Action: Mark as not duplicates
  const markNotDuplicates = useCallback(async () => {
    if (!currentPair) return;

    cancelQueuedOperation();
    queueOperation('dismiss', currentPair);

    await advanceToNext();
  }, [currentPair, cancelQueuedOperation, queueOperation, advanceToNext]);

  // Action: Mark as reviewed
  const markReviewed = useCallback(async () => {
    if (!currentPair) return;

    cancelQueuedOperation();
    queueOperation('reviewed', currentPair);

    await advanceToNext();
  }, [currentPair, cancelQueuedOperation, queueOperation, advanceToNext]);

  // Action: Go back
  const goBack = useCallback(() => {
    if (!canGoBack || !previousPair) return;

    // Cancel the queued operation
    cancelQueuedOperation();

    // Restore previous pair as current
    setCurrentPair(previousPair);
    setPreviousPair(null);
    setQueuedOperation(null);
  }, [canGoBack, previousPair, cancelQueuedOperation]);

  // Action: Close modal
  const closeModal = useCallback(async () => {
    // Execute any pending operations immediately
    if (queuedOperation && queuedOperation.status === 'pending') {
      clearQueueTimer();
      setQueuedOperation(prev =>
        prev ? { ...prev, status: 'executed' } : null
      );
      // Wait a moment for execution
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Clean up
    clearQueueTimer();
    setCurrentPair(null);
    setPreviousPair(null);
    setQueuedOperation(null);
    setIsComplete(false);
  }, [queuedOperation, clearQueueTimer]);

  return {
    // State
    currentPair,
    previousPair,
    isLoading,
    isComplete,
    canGoBack,
    error,
    queuedOperation,

    // Actions
    selectAuthor,
    skip,
    markNotDuplicates,
    markReviewed,
    goBack,
    loadInitialPair,
    closeModal
  };
}

