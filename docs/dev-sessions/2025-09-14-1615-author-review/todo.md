# Development Session TODO
**Date**: 2025-09-14 16:15
**Branch**: author-review
**Session**: Streamline Author Duplicate Merging

## Phase 1: Foundation
- [ ] Create `useReviewFlow` custom hook for state management
- [ ] Create API helper functions (fetchNext, executeMerge, updateStatus)
- [ ] Create QueueManager class for delayed operations

## Phase 2: Core UI Updates
- [ ] Add Back button to review modal
- [ ] Implement basic continuous flow (load next after action)
- [ ] Add loading states for transitions

## Phase 3: Keyboard Support
- [ ] Add keyboard event listener with all shortcuts
- [ ] Map keys to actions (1/2, arrows, S, N, R, Backspace, Escape)
- [ ] Add visual feedback for keyboard actions

## Phase 4: Queue & Undo System
- [ ] Implement 2-second queue delay for operations
- [ ] Add back/undo functionality with state management
- [ ] Handle queue execution and back button states

## Phase 5: Additional Actions
- [ ] Implement Skip action (S key)
- [ ] Implement Not Duplicates action (N key)
- [ ] Implement Mark Reviewed action (R key)

## Phase 6: Polish & Edge Cases
- [ ] Add completion message when all reviewed
- [ ] Implement toast notifications for errors
- [ ] Handle modal closing with pending operations
- [ ] Add performance optimizations (preloading)

## Phase 7: Testing & Cleanup
- [ ] Test all keyboard shortcuts
- [ ] Test queue timing and undo functionality
- [ ] Test error scenarios
- [ ] Test with 0, 1, and many duplicates
- [ ] Final integration and polish

## Documentation
- [ ] Update notes.md with implementation details
- [ ] Document keyboard shortcuts for users
- [ ] Create final summary for commit message