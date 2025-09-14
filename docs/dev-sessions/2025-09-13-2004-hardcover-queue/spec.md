# Hardcover Queue Specification

## Overview
Implement a processing queue system to manage and track books being updated with Hardcover information. This prevents redundant processing when clients restart or multiple clients run simultaneously.

## Problem Statement
Currently, when the CLI client requests books to update with Hardcover data, it always starts from the beginning. If a client restarts or multiple clients run, they process the same books repeatedly, wasting API calls and processing time.

## Solution
Create a queue management system using a separate database table to track which books are being processed by which client instance.

## Database Schema

### New Table: `HardcoverQueue`
```prisma
model HardcoverQueue {
  id           String    @id @default(uuid())
  bookId       String    @unique
  processingId String?   // UUID assigned when claimed by a client
  claimTime    DateTime? // Timestamp when claimed

  @@index([processingId])
  @@index([claimTime])
}
```

## Queue Initialization
1. Pre-populate the table with all books where `hardcoverId` is null
2. When new books are added to the system, automatically add them to the queue (since they won't have a hardcoverId)

## API Modifications

### 1. Modify Existing Endpoint: `/api/missing/hardcover`

#### Request
```typescript
GET /api/missing/hardcover?previousProcessingId={uuid}
```

#### Behavior
1. If `previousProcessingId` is provided:
   - Delete all `HardcoverQueue` records where `processingId = previousProcessingId`
2. Select up to 100 books where `processingId IS NULL` (using current ordering)
3. Generate a new UUID for `processingId`
4. Update selected books with new `processingId` and `claimTime = NOW()`
5. Return the books with additional metadata

#### Response
```typescript
{
  books: Book[],           // Array of book objects (current format)
  processingId: string,     // The new UUID for this batch
  remainingUnclaimed: number // Count of books with processingId = null
}
```

### 2. New Admin Endpoint: Reset Old Claims
```typescript
POST /api/admin/hardcover-queue/reset?olderThan={minutes}
```

#### Behavior
- Find all records where `claimTime < NOW() - {minutes}`
- Set `processingId = NULL` and `claimTime = NULL` for these records
- Return count of reset claims

#### Response
```typescript
{
  resetCount: number
}
```

### 3. New Admin Endpoint: Reset Specific Claim
```typescript
DELETE /api/admin/hardcover-queue/claims/{processingId}
```

#### Behavior
- Find all records where `processingId = {processingId}`
- Set `processingId = NULL` and `claimTime = NULL` for these records
- Return count of reset claims

#### Response
```typescript
{
  resetCount: number
}
```

### 4. New Admin Endpoint: Cleanup Completed Books
```typescript
POST /api/admin/hardcover-queue/cleanup
```

#### Behavior
- Delete all `HardcoverQueue` records where the corresponding book has a non-null `hardcoverId`
- Return count of removed records

#### Response
```typescript
{
  removedCount: number
}
```

## Automatic Cleanup
When a book record is updated with a `hardcoverId`:
1. Automatically delete the corresponding record from `HardcoverQueue`
2. This happens regardless of processing status

## Edge Cases & Error Handling

### Invalid previousProcessingId
- No special handling needed - DELETE operation will simply affect 0 rows
- Proceed normally with claiming new books

### No Unclaimed Books Available
- Return empty array for books
- Still return processingId (new UUID) and remainingUnclaimed (0)

### Concurrent Processing
- No special handling for same processingId used by multiple clients
- System assumes clients manage their own processingIds responsibly

## Implementation Notes

1. **Transaction Safety**: Use database transactions when updating processingId to ensure atomic operations
2. **Indexing**: Index on `processingId` and `claimTime` for query performance
3. **Monitoring**: The `remainingUnclaimed` count helps monitor queue health
4. **Backwards Compatibility**: Endpoint continues to work without `previousProcessingId` parameter for single-client scenarios

## Migration Strategy

1. Create the `HardcoverQueue` table
2. Populate with all books where `hardcoverId IS NULL`
3. Update `/api/missing/hardcover` endpoint to use queue
4. Add admin endpoints
5. Update book creation logic to add to queue
6. Update book update logic to remove from queue when hardcoverId is set

## Success Criteria

- Multiple clients can process books without duplication
- Clients can resume processing after restart without re-processing books
- Admin can manually reset stuck claims
- System automatically cleans up completed books
- No performance degradation compared to current implementation