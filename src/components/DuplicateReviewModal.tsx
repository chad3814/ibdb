'use client';

import { useEffect, useCallback, useState } from 'react';
import { useReviewFlow } from '@/hooks/useReviewFlow';
import { QueueManager } from '@/lib/QueueManager';
import { executeMerge, updateDuplicateStatus } from '@/lib/duplicateReviewApi';
import type { AuthorDuplicate } from '@/hooks/useReviewFlow';

interface DuplicateReviewModalProps {
  initialPair?: AuthorDuplicate | null;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function DuplicateReviewModal({
  isOpen,
  onClose,
  onComplete
}: DuplicateReviewModalProps) {
  const {
    currentPair,
    isLoading,
    isComplete,
    canGoBack,
    error,
    queuedOperation,
    selectAuthor,
    skip,
    markNotDuplicates,
    markReviewed,
    goBack,
    loadInitialPair,
    closeModal
  } = useReviewFlow();

  const [queueManager] = useState(() => new QueueManager({
    delay: 2000,
    onExecute: async (operation) => {
      const { type, data } = operation;
      const duplicate = data.duplicate as AuthorDuplicate;

      try {
        if (type === 'merge' && data.targetAuthorId) {
          await executeMerge(duplicate, data.targetAuthorId);
        } else if (type === 'dismiss') {
          await updateDuplicateStatus(duplicate.id, 'dismissed', 'Not duplicates');
        } else if (type === 'reviewed') {
          await updateDuplicateStatus(duplicate.id, 'reviewed');
        }
      } catch (error) {
        console.error(`Failed to execute ${type} operation:`, error);
        throw error;
      }
    },
    onError: (operation, error) => {
      // Show toast notification
      showToast(`Failed to ${operation.type}: ${error.message}`, 'error');
    }
  }));

  // Queue operations when they change
  useEffect(() => {
    if (queuedOperation && queuedOperation.status === 'pending') {
      queueManager.enqueue(
        queuedOperation.type as ('merge' | 'dismiss' | 'reviewed'),
        {
          duplicate: queuedOperation.duplicate,
          targetAuthorId: queuedOperation.targetAuthorId
        }
      );
    }
  }, [queuedOperation, queueManager]);

  // Load initial pair when modal opens
  useEffect(() => {
    if (isOpen && !currentPair && !isLoading) {
      loadInitialPair();
    }
  }, [isOpen, currentPair, isLoading, loadInitialPair]);

  const handleClose = useCallback(async () => {
    // Execute any pending operations
    await queueManager.executeAll();
    await closeModal();
    onClose();
  }, [queueManager, closeModal, onClose]);

  // Keyboard event handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
        case 'ArrowLeft':
          if (currentPair && !currentPair.author1?.deleted) {
            selectAuthor(currentPair.author1Id);
          }
          break;
        case '2':
        case 'ArrowRight':
          if (currentPair && !currentPair.author2?.deleted) {
            selectAuthor(currentPair.author2Id);
          }
          break;
        case 's':
        case 'S':
          skip();
          break;
        case 'n':
        case 'N':
          markNotDuplicates();
          break;
        case 'r':
        case 'R':
          markReviewed();
          break;
        case 'Backspace':
          if (canGoBack) {
            goBack();
          }
          break;
        case 'Escape':
          handleClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    currentPair,
    canGoBack,
    selectAuthor,
    skip,
    markNotDuplicates,
    markReviewed,
    goBack,
    handleClose
  ]);

  // Handle completion
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-end justify-center px-4 pb-20 pt-4 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pb-4 pt-5 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-900" id="modal-title">
                Review Duplicate Authors
              </h2>
              {/* Back button */}
              <button
                onClick={goBack}
                disabled={!canGoBack}
                className={`
                  flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium
                  ${canGoBack
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }
                `}
                title="Go back (Backspace)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="mt-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4 mb-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {isComplete && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">All duplicates reviewed!</h3>
                <button
                  onClick={handleClose}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Close
                </button>
              </div>
            )}

            {currentPair && !isLoading && !isComplete && (
              <>
                {/* Match score banner */}
                <div className={`
                  rounded-lg border-2 p-4 mb-6
                  ${currentPair.score >= 90 ? 'bg-green-50 border-green-400' :
                    currentPair.score >= 80 ? 'bg-blue-50 border-blue-400' :
                    currentPair.score >= 70 ? 'bg-yellow-50 border-yellow-400' :
                    'bg-gray-50 border-gray-400'}
                `}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`
                        px-3 py-1 rounded-full text-white font-bold
                        ${currentPair.score >= 90 ? 'bg-green-400' :
                          currentPair.score >= 80 ? 'bg-blue-400' :
                          currentPair.score >= 70 ? 'bg-yellow-400' :
                          'bg-gray-400'}
                      `}>
                        {currentPair.score}%
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Match Score: {currentPair.score}%</h3>
                        <p className="text-sm text-gray-600">
                          Confidence: {currentPair.confidence.charAt(0).toUpperCase() + currentPair.confidence.slice(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Author cards */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Author 1 */}
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">{currentPair.author1Name}</h3>
                      <p className="text-sm text-gray-500 font-mono">ID: {currentPair.author1Id}</p>
                      {currentPair.author1?.deleted && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                          Deleted
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <span className="font-medium text-gray-900">
                        Books ({currentPair.author1?.books?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={() => selectAuthor(currentPair.author1Id)}
                      disabled={currentPair.author1?.deleted}
                      className={`
                        w-full px-4 py-2 rounded-md font-medium
                        ${currentPair.author1?.deleted
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }
                      `}
                      title="Select with 1 or ←"
                    >
                      Keep This Author (1)
                    </button>
                  </div>

                  {/* Author 2 */}
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">{currentPair.author2Name}</h3>
                      <p className="text-sm text-gray-500 font-mono">ID: {currentPair.author2Id}</p>
                      {currentPair.author2?.deleted && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-2">
                          Deleted
                        </span>
                      )}
                    </div>

                    <div className="mb-4">
                      <span className="font-medium text-gray-900">
                        Books ({currentPair.author2?.books?.length || 0})
                      </span>
                    </div>

                    <button
                      onClick={() => selectAuthor(currentPair.author2Id)}
                      disabled={currentPair.author2?.deleted}
                      className={`
                        w-full px-4 py-2 rounded-md font-medium
                        ${currentPair.author2?.deleted
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }
                      `}
                      title="Select with 2 or →"
                    >
                      Keep This Author (2)
                    </button>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    onClick={skip}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    title="Skip (S)"
                  >
                    Skip (S)
                  </button>
                  <button
                    onClick={markNotDuplicates}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                    title="Not Duplicates (N)"
                  >
                    Not Duplicates (N)
                  </button>
                  <button
                    onClick={markReviewed}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    title="Mark Reviewed (R)"
                  >
                    Mark Reviewed (R)
                  </button>
                </div>

                {/* Keyboard shortcuts help */}
                <div className="mt-6 text-center text-xs text-gray-500">
                  <span className="inline-block mx-1">1/← = Author 1</span> •
                  <span className="inline-block mx-1">2/→ = Author 2</span> •
                  <span className="inline-block mx-1">S = Skip</span> •
                  <span className="inline-block mx-1">N = Not Duplicates</span> •
                  <span className="inline-block mx-1">R = Reviewed</span> •
                  <span className="inline-block mx-1">Backspace = Back</span> •
                  <span className="inline-block mx-1">Esc = Close</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple toast notification (will be replaced with proper implementation)
function showToast(message: string, type: 'success' | 'error' | 'info') {
  // This is a placeholder - in production, use a proper toast library
  console.log(`[${type.toUpperCase()}] ${message}`);

  // Create a simple toast element
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
    type === 'error' ? 'bg-red-500' :
    type === 'success' ? 'bg-green-500' :
    'bg-blue-500'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}