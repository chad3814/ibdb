# Development Session Specification
**Date**: 2025-09-14 16:15
**Branch**: author-review
**Session**: Streamline Author Duplicate Merging

## Objective
Transform the author duplicate review process from a one-at-a-time operation to a continuous flow system that allows rapid processing of large volumes of duplicate pairs (currently 4,800+ pending reviews).

## Core Concept
After a user makes a selection on a duplicate pair, the modal automatically advances to the next pending pair, creating a continuous review flow. Merges are queued briefly before execution, allowing for quick undo if needed.

## Requirements

### 1. Continuous Flow
- When a user selects an action (merge, skip, not duplicates, or mark reviewed), automatically load and display the next pending duplicate pair
- No need to close and reopen the modal between reviews
- Smooth transition between pairs for rapid processing

### 2. Merge Queue System
- Selected merges are queued for "a couple seconds" before execution
- This delay provides a window for the user to undo if they realize they made a mistake
- Once a merge executes, it cannot be undone through the back button

### 3. Back/Undo Functionality
- Add a "Back" button to the modal
- Back button cancels the most recent queued action and returns to the previous pair
- Only one level of undo is supported (can only go back to the immediately previous pair)
- Back button is disabled when:
  - On the first pair with no previous action
  - After returning from a previous back action
  - When the previous merge has already executed
- Once a user makes a new selection, any previously queued items become inaccessible

### 4. Keyboard Shortcuts
- **1 or ←**: Select first author (left)
- **2 or →**: Select second author (right)
- **S**: Skip (move to next pair without action)
- **N**: Mark as "not duplicates"
- **R**: Mark as "reviewed" without merging
- **Backspace**: Back (undo last action)
- **Escape**: Close modal

### 5. Visual Design
- Use the existing review modal design - no changes to the information displayed
- Add only the Back button (disabled/enabled based on state)
- No progress indicators or merge queue counters needed
- Keep the interface minimal and focused

### 6. Error Handling
- If a merge fails (network error, database conflict, etc.), show a toast notification
- Failed merges remain as pending duplicates for future review sessions
- Errors should not interrupt the flow - user continues to next pair

### 7. Completion Behavior
- When all pending duplicates have been reviewed, show a completion message
- Example: "All duplicates reviewed!"

### 8. Modal Closing Behavior
- When user presses Escape or closes the modal, any queued merges complete execution before closing
- No confirmation prompt needed
- Ensures no work is lost

### 9. Modal Opening Behavior
- Modal opens when user clicks on a review button for a specific duplicate pair
- No special position tracking or resume functionality needed
- Each session starts fresh from the selected pair

## Success Criteria
1. User can process hundreds of duplicate pairs in a single session without modal interaction overhead
2. Merge queue provides sufficient time to catch and undo mistakes
3. Keyboard shortcuts enable hands-on-keyboard workflow for maximum efficiency
4. System handles all edge cases gracefully without interrupting flow
5. Error states are non-blocking and informative

## Technical Considerations

### State Management
- Track current pair being reviewed
- Maintain queue of pending merges with timestamps
- Store previous pair data for back functionality
- Handle disabled/enabled state of back button

### API Considerations
- Merges should be processed asynchronously
- Need endpoint to fetch next pending duplicate pair
- Consider batching merge operations for better performance

### Performance
- Preload next pair while current merge is queuing
- Ensure smooth transitions between pairs
- Handle large volumes (4,800+) without memory issues

## Implementation Priority
1. Core continuous flow mechanism
2. Keyboard shortcuts for selection (1/2, arrows)
3. Back button functionality
4. Skip/Not Duplicates/Reviewed actions
5. Error handling and completion message

## Constraints
- Must work with existing modal structure
- Cannot modify the information displayed about duplicate pairs
- Must maintain data integrity (no lost merges or corrupted data)
- Should be compatible with existing duplicate detection system