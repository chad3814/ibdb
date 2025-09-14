# Development Session Plan: Streamline Author Duplicate Merging
**Date**: 2025-09-14 16:15
**Branch**: author-review
**Session**: author-review

## Implementation Blueprint

### Phase 1: Foundation - State Management & Data Flow
Create the core state management system that will handle the continuous flow, merge queue, and undo functionality.

### Phase 2: API Integration
Implement the API endpoint for fetching the next pending duplicate pair and modify existing merge endpoints for queue support.

### Phase 3: Modal Enhancement - Basic Structure
Add the Back button to the existing modal and set up the basic continuous flow mechanism without keyboard shortcuts.

### Phase 4: Keyboard Shortcuts
Implement comprehensive keyboard shortcut handling for all actions (1/2, arrows, S, N, R, Backspace, Escape).

### Phase 5: Queue System & Timing
Implement the merge queue with 2-second delay and automatic execution.

### Phase 6: Back/Undo Logic
Implement the complete back button functionality with proper state management and edge case handling.

### Phase 7: Completion & Error Handling
Add completion message, error toasts, and handle edge cases.

### Phase 8: Integration & Polish
Wire everything together, test the flow, and ensure smooth transitions.

---

## Detailed Step Breakdown

### Step 1: Create Review Flow State Hook
- Create a custom hook `useReviewFlow` to manage all state
- Track: current pair, previous pair, queue, back button status
- Keep it isolated for easier testing and maintenance

### Step 2: Add API Helper Functions
- Create function to fetch next pending duplicate
- Modify merge function to support queue delay
- Add functions for skip, not duplicates, and mark reviewed actions

### Step 3: Create Queue Manager
- Implement a queue system with timeouts
- Track pending operations with timestamps
- Handle automatic execution after delay
- Support cancellation for undo

### Step 4: Update Modal UI - Add Back Button
- Add Back button to the modal UI
- Position it appropriately in the existing layout
- Handle disabled/enabled states visually

### Step 5: Implement Basic Continuous Flow
- Connect select author buttons to advance to next pair
- Load next duplicate after each action
- Handle loading states during transitions

### Step 6: Add Keyboard Event Listener
- Create a keyboard event handler
- Map keys to actions (1/2, arrows, S, N, R, Backspace, Escape)
- Ensure proper cleanup on unmount

### Step 7: Implement Queue Execution
- Set up 2-second timer for queued merges
- Execute merges automatically after delay
- Update back button state when merge executes

### Step 8: Implement Back/Undo Functionality
- Store previous pair data
- Handle back button click and Backspace key
- Cancel queued operation and restore previous state
- Manage back button disabled states correctly

### Step 9: Add Action Handlers
- Implement Skip (S key)
- Implement Not Duplicates (N key)
- Implement Mark Reviewed (R key)
- Ensure all actions advance to next pair

### Step 10: Add Completion Handling
- Detect when no more pairs available
- Show completion message
- Handle modal state appropriately

### Step 11: Add Error Handling
- Implement toast notifications for errors
- Ensure errors don't break the flow
- Keep failed merges as pending

### Step 12: Handle Modal Closing
- Implement Escape key handler
- Ensure queued merges complete before closing
- Clean up all state and timers

### Step 13: Optimize Performance
- Implement preloading of next pair
- Ensure smooth transitions
- Handle large datasets efficiently

### Step 14: Final Integration
- Connect all components
- Test full flow end-to-end
- Polish transitions and user experience

---

## LLM Implementation Prompts

### Prompt 1: Create the Review Flow State Hook

```markdown
Create a custom React hook called `useReviewFlow` that manages the state for a continuous author duplicate review flow. The hook should:

1. Track the current duplicate pair being reviewed
2. Track the previous pair for undo functionality
3. Manage a queue of pending operations with timestamps
4. Track whether the back button should be enabled
5. Track if we're currently loading the next pair
6. Track if all duplicates have been reviewed

The hook should return:
- Current state values
- Action functions (selectAuthor, skip, markNotDuplicates, markReviewed, goBack)
- Loading and completion states

Use TypeScript and include proper types for AuthorDuplicate objects. The queue should store operation type, duplicate pair, target author (if merge), and timestamp.
```

### Prompt 2: Create API Helper Functions

```markdown
Create API helper functions for the duplicate review flow. We need:

1. `fetchNextPendingDuplicate(currentId?: string)` - Fetches the next pending duplicate pair, excluding the current one
2. `executeMerge(duplicate: AuthorDuplicate, targetAuthorId: string)` - Executes a merge operation
3. `updateDuplicateStatus(id: string, status: 'dismissed' | 'reviewed' | 'skipped', notes?: string)` - Updates duplicate status

These should:
- Use the existing API endpoints where possible
- Return appropriate error messages for toast notifications
- Handle network errors gracefully
- Include TypeScript types

Base URLs:
- GET `/api/admin/duplicates?status=pending&limit=1&exclude=${currentId}`
- POST `/api/admin/duplicates/merge`
- PATCH `/api/admin/duplicates`
```

### Prompt 3: Create the Queue Manager

```markdown
Create a QueueManager class that handles delayed execution of operations. Requirements:

1. Add operations to queue with a 2-second delay
2. Track operation status (pending, executed, cancelled)
3. Support cancelling the most recent operation
4. Automatically execute operations after delay
5. Notify when operations complete or fail

The class should:
- Use setTimeout for delays
- Store operation metadata (type, timestamp, data)
- Provide methods: enqueue(), cancelLast(), executeNow(), clear()
- Use callbacks for onExecute, onError, onCancel events
- Handle cleanup of completed operations

Include TypeScript types for operations and events.
```

### Prompt 4: Update Modal UI with Back Button

```markdown
Update the existing author duplicate review modal to add a Back button. The modal currently shows two authors side by side with merge buttons for each.

Add:
1. A "Back" button in the modal header or footer
2. Visual disabled state when back is not available
3. Proper positioning that doesn't disrupt the existing layout
4. Icon (arrow-left or similar) with "Back" text

The button should:
- Be clearly visible but not prominent
- Show disabled state with reduced opacity
- Have proper accessibility attributes
- Use existing Tailwind classes for consistency

Current modal structure has:
- Header with title and close button
- Two author cards side by side
- Action buttons at the bottom
```

### Prompt 5: Implement Continuous Flow Logic

```markdown
Implement the continuous flow logic in the duplicate review modal. When a user selects an action (merge, skip, not duplicates, reviewed), the modal should:

1. Show a loading state briefly
2. Fetch the next pending duplicate
3. Update the display with the new pair
4. Enable the back button (since we now have a previous action)
5. Handle the case when no more duplicates exist

Connect the existing merge buttons and action buttons to:
- Call the appropriate API function
- Add operation to the queue
- Advance to the next pair
- Update all relevant state

Ensure smooth transitions between pairs with appropriate loading indicators.
```

### Prompt 6: Add Keyboard Event Handling

```markdown
Implement comprehensive keyboard shortcut handling for the duplicate review modal:

Shortcuts to implement:
- 1 or ← : Select first (left) author
- 2 or → : Select second (right) author
- S : Skip to next pair
- N : Mark as not duplicates
- R : Mark as reviewed
- Backspace : Go back/undo
- Escape : Close modal

Requirements:
- Add event listener when modal opens
- Remove listener when modal closes
- Prevent default browser behaviors
- Ignore events when input fields are focused
- Handle both keydown events
- Show visual feedback when keys are pressed

Use React useEffect for lifecycle management.
```

### Prompt 7: Implement Queue Execution Logic

```markdown
Implement the queue execution logic that processes operations after a 2-second delay:

1. When an operation is added to queue, start a 2-second timer
2. After 2 seconds, execute the operation (merge, dismiss, review)
3. Once executed, disable the back button for that operation
4. Handle execution errors with toast notifications
5. Continue to next pair regardless of success/failure

The implementation should:
- Use the QueueManager class created earlier
- Update the back button state when operations execute
- Show toast notifications for errors
- Not interrupt the user's current review
- Clean up completed operations from memory
```

### Prompt 8: Implement Complete Back/Undo Logic

```markdown
Implement the complete back/undo functionality:

1. When Back button is clicked or Backspace is pressed:
   - Cancel the queued operation if it hasn't executed
   - Restore the previous duplicate pair for re-review
   - Clear the "previous pair" state (can't go back further)
   - Disable the back button

2. Handle edge cases:
   - First pair (no previous) - back button disabled
   - After going back once - back button disabled
   - Previous operation already executed - back button disabled
   - Rapid back presses - handle gracefully

3. State management:
   - Store only one level of history
   - Clear history when new selection is made
   - Track whether back is available
```

### Prompt 9: Implement Additional Actions

```markdown
Implement the Skip, Not Duplicates, and Mark Reviewed actions:

1. Skip (S key):
   - Don't modify the duplicate status
   - Simply advance to the next pair
   - Don't add to queue (no undo needed)

2. Not Duplicates (N key):
   - Update status to 'dismissed' with note "Not duplicates"
   - Add to queue for undo capability
   - Advance to next pair

3. Mark Reviewed (R key):
   - Update status to 'reviewed'
   - Add to queue for undo capability
   - Advance to next pair

Each action should:
- Work via keyboard shortcut
- Could add UI buttons if desired
- Follow the same flow pattern as merge
- Support undo via back button
```

### Prompt 10: Add Completion Handling

```markdown
Implement completion handling when all duplicates have been reviewed:

1. Detect when fetchNextPendingDuplicate returns no results
2. Display a completion message in the modal:
   - "All duplicates reviewed!"
   - Show as a centered message in place of the author cards
   - Include a "Close" button
3. Disable all keyboard shortcuts except Escape
4. Clear any remaining queued operations
5. Update parent component's stats/counts

The completion screen should:
- Use existing modal structure
- Be visually distinct but consistent
- Provide clear next actions
```

### Prompt 11: Add Error Handling

```markdown
Implement comprehensive error handling with toast notifications:

1. Create a toast notification system (or integrate existing one)
2. Handle errors from:
   - Merge operations failing
   - Network timeouts
   - API errors
   - Invalid state conditions

3. Toast notifications should:
   - Appear briefly (3 seconds)
   - Not block interaction
   - Stack if multiple errors
   - Include error type/message
   - Use appropriate colors (red for errors)

4. Error recovery:
   - Failed merges remain as pending duplicates
   - Continue to next pair after error
   - Log errors to console for debugging
```

### Prompt 12: Handle Modal Closing

```markdown
Implement proper modal closing behavior:

1. When Escape is pressed or close button clicked:
   - Check if any operations are queued
   - Execute all queued operations immediately
   - Wait for completion
   - Then close the modal

2. Clean up:
   - Remove keyboard event listeners
   - Clear all timers
   - Reset state to initial values
   - Cancel any pending API requests

3. Show brief loading state if operations are executing
4. Ensure no memory leaks from timers or listeners
5. Update parent component after closing
```

### Prompt 13: Optimize Performance

```markdown
Optimize the review flow for performance with large datasets:

1. Implement preloading:
   - Fetch next pair while current operation is in queue
   - Cache the next pair for instant display
   - Invalidate cache if user goes back

2. Optimize transitions:
   - Use CSS transitions for smooth visual changes
   - Minimize re-renders with proper React.memo usage
   - Debounce rapid keyboard inputs

3. Memory management:
   - Limit history to just previous pair
   - Clear old queue items after execution
   - Use weak references where appropriate

4. Loading states:
   - Show skeleton loaders for smooth transitions
   - Indicate background operations subtly
```

### Prompt 14: Final Integration and Polish

```markdown
Complete the final integration of all components:

1. Wire together:
   - Review flow hook
   - Queue manager
   - API helpers
   - Keyboard handlers
   - UI components

2. Add polish:
   - Smooth transitions between states
   - Consistent loading indicators
   - Clear visual feedback for actions
   - Helpful tooltips for keyboard shortcuts

3. Edge case handling:
   - Network disconnection
   - Browser back button
   - Session timeout
   - Concurrent modifications

4. Testing considerations:
   - Verify all keyboard shortcuts work
   - Test with 0, 1, many duplicates
   - Test rapid action sequences
   - Verify queue timing
   - Test error scenarios

Ensure the implementation maintains the existing modal structure while adding the new continuous flow functionality seamlessly.
```

---

## Implementation Notes

1. **State Management**: Use a custom hook to encapsulate all the complex state logic
2. **Queue System**: Implement as a separate class for better testability and reusability
3. **API Layer**: Keep API calls separate from UI logic for maintainability
4. **Keyboard Handling**: Use a single event listener with a switch statement for all shortcuts
5. **Error Boundaries**: Consider adding React error boundaries for robustness
6. **Performance**: Preload next pair during the 2-second queue delay for instant transitions
7. **Accessibility**: Ensure all keyboard shortcuts have visual alternatives
8. **Testing**: Each component should be independently testable

## Risk Mitigation

- **Data Loss**: Queue system ensures operations complete even if modal closes
- **User Error**: 2-second delay and back button provide safety net
- **Performance**: Preloading and caching prevent slow transitions
- **Network Issues**: Graceful error handling keeps flow uninterrupted
- **State Corruption**: Immutable state updates and proper cleanup

## Success Metrics

- Process 100+ duplicates in under 5 minutes
- Zero data loss from interrupted sessions
- Instant transitions between pairs (<100ms)
- All keyboard shortcuts responsive
- Clear feedback for all actions