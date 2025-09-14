# Hardcover Queue Implementation Plan

## Overview
This plan breaks down the Hardcover Queue feature into small, iterative steps that build upon each other. Each step is designed to be safely implementable and testable in isolation.

## Phase 1: Database Foundation

### Step 1.1: Create the Database Schema
Create the HardcoverQueue model in Prisma schema with proper indexes and relationships.

### Step 1.2: Generate and Apply Migration
Generate the Prisma migration and apply it to create the table in the database.

### Step 1.3: Create Initial Population Script
Create a standalone script to populate the HardcoverQueue table with existing books that need Hardcover data.

## Phase 2: Core Queue Logic

### Step 2.1: Create Queue Service Module
Create a service module with basic queue operations (claim, release, cleanup) using transactions for safety.

### Step 2.2: Add Queue Integration to Book Creation
Modify book creation logic to automatically add new books to the queue.

### Step 2.3: Add Queue Cleanup on Book Update
Modify book update logic to remove books from queue when hardcoverId is set.

## Phase 3: API Endpoint Modifications

### Step 3.1: Modify GET /api/missing/hardcover - Basic Queue Support
Update the endpoint to use the queue system for selecting books (without processingId support yet).

### Step 3.2: Add ProcessingId Support to GET Endpoint
Add full processingId claim/release logic to the endpoint with transaction safety.

### Step 3.3: Update Response Format
Modify the response to include processingId and remainingUnclaimed count.

## Phase 4: Admin Endpoints

### Step 4.1: Create Reset Old Claims Endpoint
Create POST /api/admin/hardcover-queue/reset endpoint for time-based claim resets.

### Step 4.2: Create Reset Specific Claim Endpoint
Create DELETE /api/admin/hardcover-queue/claims/[processingId] endpoint.

### Step 4.3: Create Cleanup Endpoint
Create POST /api/admin/hardcover-queue/cleanup for removing completed books.

## Phase 5: Testing and Integration

### Step 5.1: Create Test Suite
Create comprehensive tests for queue operations and edge cases.

### Step 5.2: Update CLI Client
Update the CLI client to use the new processingId system.

---

# Implementation Prompts

## Prompt 1: Create Database Schema

**Context**: We're building a queue system to track books being processed for Hardcover data updates. This prevents duplicate processing when clients restart or run concurrently.

**Task**: Add the HardcoverQueue model to the Prisma schema file.

```
Add a new model called HardcoverQueue to prisma/schema.prisma with these fields:
- id: String, primary key, default uuid
- bookId: String, unique constraint, references Book.id
- processingId: String, optional (nullable)
- claimTime: DateTime, optional (nullable)

Add indexes on processingId and claimTime for query performance.
Add a relation to the Book model.
```

## Prompt 2: Generate and Apply Migration

**Context**: We've added the HardcoverQueue model to the Prisma schema.

**Task**: Generate and apply the database migration.

```
1. Generate a new Prisma migration named "add-hardcover-queue"
2. Review the generated SQL to ensure it's correct
3. Apply the migration to the database
```

## Prompt 3: Create Population Script

**Context**: We have the HardcoverQueue table created. Now we need to populate it with existing books that need Hardcover data.

**Task**: Create a script to populate the queue with books missing hardcoverId.

```
Create a new file scripts/populate-hardcover-queue.ts that:
1. Connects to the database using Prisma
2. Finds all books where hardcoverId is null
3. For each book, creates a HardcoverQueue entry with:
   - bookId: the book's id
   - processingId: null
   - claimTime: null
4. Uses upsert to avoid duplicates if script is run multiple times
5. Reports how many queue entries were created
6. Handles errors gracefully
```

## Prompt 4: Create Queue Service Module

**Context**: We need a centralized service to handle all queue operations with proper transaction support.

**Task**: Create a queue service module with core operations.

```
Create src/server/hardcoverQueue.ts with these functions:

1. claimBooks(previousProcessingId?: string, limit: number = 100)
   - Delete records with previousProcessingId if provided
   - Select unclaimed books (processingId is null)
   - Generate new UUID for processingId
   - Update selected books with new processingId and current timestamp
   - Return books, processingId, and remaining unclaimed count
   - Use a transaction for atomicity

2. releaseClaim(processingId: string)
   - Set processingId and claimTime to null for matching records
   - Return count of released records

3. releaseOldClaims(minutes: number)
   - Find records where claimTime is older than specified minutes
   - Set processingId and claimTime to null
   - Return count of released records

4. cleanupCompleted()
   - Delete queue records where book has hardcoverId
   - Return count of deleted records

5. addBookToQueue(bookId: string)
   - Create queue entry for new book
   - Handle duplicate key errors gracefully

6. removeBookFromQueue(bookId: string)
   - Delete queue entry for book
   - Return boolean indicating if record was deleted
```

## Prompt 5: Integrate Queue with Book Creation

**Context**: We have the queue service module. Now we need to automatically add new books to the queue.

**Task**: Modify book creation to add books to the queue.

```
Find where books are created in the codebase (likely in API routes or import scripts).
After each book creation:
1. Import the hardcoverQueue service
2. Call addBookToQueue(newBook.id) after successful book creation
3. Log any errors but don't fail the book creation if queue addition fails
```

## Prompt 6: Integrate Queue with Book Updates

**Context**: Books should be removed from the queue when they receive a hardcoverId.

**Task**: Modify book update logic to remove books from queue.

```
Find where books are updated with hardcoverId (likely in /api/missing/[external]/route.ts POST handler).
After successful book update where hardcoverId is set:
1. Import the hardcoverQueue service
2. Call removeBookFromQueue(bookId) after successful update
3. Log the result but don't fail the update if queue removal fails
```

## Prompt 7: Update GET /api/missing/hardcover - Basic Queue

**Context**: The current endpoint returns books missing hardcover data. We need to use the queue system.

**Task**: Modify the GET handler to use the queue for book selection.

```
Update GET handler in /api/missing/[external]/route.ts:
1. Only process if external === 'hardcover'
2. Instead of querying editions directly, query HardcoverQueue where processingId is null
3. Join with Book and Edition data to get the same response format
4. Maintain the same response structure for backwards compatibility
5. Keep the current ordering and limit of 100
```

## Prompt 8: Add Full ProcessingId Support

**Context**: The endpoint now uses the queue. We need to add processingId claim/release logic.

**Task**: Add processingId parameter support to the GET handler.

```
Update GET handler to:
1. Check for previousProcessingId query parameter
2. Import and use the claimBooks function from hardcoverQueue service
3. Use the returned data to build the response
4. Map the returned books to the existing MissingInfo format
5. Add processingId and remainingUnclaimed to the response
6. Ensure backwards compatibility when previousProcessingId is not provided
```

## Prompt 9: Update Response Format

**Context**: The endpoint needs to return additional metadata for queue monitoring.

**Task**: Update the response type and format.

```
1. Update types/missing.d.ts to add new response fields:
   - processingId: string
   - remainingUnclaimed: number
2. Update the GET handler to include these fields in the response
3. Ensure the response maintains backwards compatibility
```

## Prompt 10: Create Reset Old Claims Endpoint

**Context**: Admins need to reset claims that have been held too long.

**Task**: Create the reset old claims admin endpoint.

```
Create /api/admin/hardcover-queue/reset/route.ts:
1. Create POST handler
2. Check for admin authentication (use existing pattern from other admin endpoints)
3. Get 'olderThan' from query parameters (default to 30 minutes)
4. Call releaseOldClaims from hardcoverQueue service
5. Return { resetCount: number }
6. Handle errors with appropriate status codes
```

## Prompt 11: Create Reset Specific Claim Endpoint

**Context**: Admins need to reset specific processing claims.

**Task**: Create the reset specific claim endpoint.

```
Create /api/admin/hardcover-queue/claims/[processingId]/route.ts:
1. Create DELETE handler
2. Check for admin authentication
3. Get processingId from route parameters
4. Call releaseClaim from hardcoverQueue service
5. Return { resetCount: number }
6. Handle errors with appropriate status codes
```

## Prompt 12: Create Cleanup Endpoint

**Context**: Admins need to clean up queue entries for books that already have hardcoverIds.

**Task**: Create the cleanup endpoint.

```
Create /api/admin/hardcover-queue/cleanup/route.ts:
1. Create POST handler
2. Check for admin authentication
3. Call cleanupCompleted from hardcoverQueue service
4. Return { removedCount: number }
5. Handle errors with appropriate status codes
```

## Prompt 13: Create Test Suite

**Context**: We need comprehensive tests for the queue system.

**Task**: Create tests for queue operations.

```
Create __tests__/hardcoverQueue.test.ts:
1. Test claimBooks with and without previousProcessingId
2. Test concurrent claims don't overlap
3. Test releaseClaim functionality
4. Test releaseOldClaims with various time windows
5. Test cleanupCompleted removes correct records
6. Test addBookToQueue and removeBookFromQueue
7. Test edge cases (empty queue, invalid IDs, etc.)
```

## Prompt 14: Update CLI Client

**Context**: The CLI client needs to use the new processingId system to avoid reprocessing.

**Task**: Update the CLI client to track and send processingId.

```
Update the CLI client (likely in cli/ directory):
1. Store processingId in a local file or environment variable
2. Send previousProcessingId with each request
3. Update processingId from response
4. Handle empty response gracefully (no more books to process)
5. Add logging for queue statistics (remainingUnclaimed)
```

## Prompt 15: Final Integration and Cleanup

**Context**: All components are built. We need to ensure everything is properly connected.

**Task**: Wire everything together and test the complete flow.

```
1. Run the population script to initialize the queue
2. Test the GET /api/missing/hardcover endpoint with processingId
3. Test all admin endpoints
4. Verify book creation adds to queue
5. Verify book updates remove from queue
6. Test the CLI client with the new system
7. Add any missing error handling or logging
8. Update documentation with new endpoints and parameters
```