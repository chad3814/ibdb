# IBDB Components Documentation

## Overview

This document provides a comprehensive reference for all React components in the IBDB application. Components are organized by their function and location within the application architecture.

## Component Structure

```
src/
├── components/          # Reusable UI components
├── app/                # Page components and layouts
└── hooks/              # Custom React hooks
```

## Core Components

### Layout Components

#### `app/layout.tsx`
**Purpose**: Root layout wrapper for the entire application

**Props**:
- `children: React.ReactNode` - Page content to render

**Features**:
- Global styles application
- Metadata configuration
- Font optimization (Geist Sans/Mono)

**Usage**:
```tsx
// Automatically applied to all pages
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

---

### Display Components

#### `components/BookCard.tsx`
**Purpose**: Displays individual book information in a card format

**Props**:
- `book: ApiBook` - Book data object
- `showAuthors?: boolean` - Display author names
- `showImage?: boolean` - Display book cover image
- `linkToBook?: boolean` - Make card clickable

**Features**:
- Responsive card layout
- Cover image with fallback
- Author list display
- Link to book detail page

**Usage**:
```tsx
<BookCard
  book={bookData}
  showAuthors={true}
  showImage={true}
  linkToBook={true}
/>
```

---

#### `components/BookGrid.tsx`
**Purpose**: Displays a grid of books with infinite scroll support

**Props**:
- `initialBooks: ApiBook[]` - Initial set of books to display
- `loadMore: () => Promise<ApiBook[]>` - Function to load more books
- `hasMore: boolean` - Whether more books are available

**Features**:
- Responsive grid layout (1-4 columns)
- Infinite scroll integration
- Loading state management
- Empty state handling

**Usage**:
```tsx
<BookGrid
  initialBooks={books}
  loadMore={fetchMoreBooks}
  hasMore={hasNextPage}
/>
```

---

#### `components/AuthorsList.tsx`
**Purpose**: Displays a paginated list of authors with alphabetical filtering

**Props**:
- `authors: Author[]` - Array of author objects
- `currentLetter?: string` - Active letter filter
- `onLetterChange: (letter: string) => void` - Letter filter callback

**Features**:
- Alphabetical navigation
- Paginated display
- Author book counts
- Links to author pages

**Usage**:
```tsx
<AuthorsList
  authors={authorData}
  currentLetter="A"
  onLetterChange={handleLetterFilter}
/>
```

---

#### `components/AuthorDetail.tsx`
**Purpose**: Displays detailed author information with their bibliography

**Props**:
- `author: Author` - Author data object
- `books: ApiBook[]` - Author's books

**Features**:
- Author metadata display
- External ID links (Goodreads, OpenLibrary, Hardcover)
- Complete bibliography
- Book count statistics

**Usage**:
```tsx
<AuthorDetail
  author={authorData}
  books={authorBooks}
/>
```

---

### Interactive Components

#### `components/SearchForm.tsx`
**Purpose**: Search input form for book/author queries

**Props**:
- `initialQuery?: string` - Pre-fill search input
- `onSearch: (query: string) => void` - Search submission callback
- `placeholder?: string` - Input placeholder text

**Features**:
- Controlled input component
- Form validation
- Submit on Enter
- Clear button

**Usage**:
```tsx
<SearchForm
  initialQuery="Harry Potter"
  onSearch={handleSearch}
  placeholder="Search books or authors..."
/>
```

---

#### `components/SearchResults.tsx`
**Purpose**: Displays search results with filtering and sorting

**Props**:
- `results: ApiBook[]` - Search result books
- `query: string` - Search query used
- `loading?: boolean` - Loading state

**Features**:
- Result count display
- Grid/list view toggle
- Sort options
- No results handling

**Usage**:
```tsx
<SearchResults
  results={searchResults}
  query="tolkien"
  loading={false}
/>
```

---

### Utility Components

#### `components/LoadingSpinner.tsx`
**Purpose**: Loading indicator component

**Props**:
- `size?: 'sm' | 'md' | 'lg'` - Spinner size
- `color?: string` - Spinner color
- `text?: string` - Loading message

**Features**:
- Animated spinner
- Customizable size and color
- Optional loading text
- Accessibility support

**Usage**:
```tsx
<LoadingSpinner
  size="md"
  text="Loading books..."
/>
```

---

#### `components/Home.tsx`
**Purpose**: Homepage component with featured content

**Features**:
- Hero section
- Featured books carousel
- Recent additions
- Search prompt

**Usage**:
```tsx
<Home />
```

---

## Page Components

### Book Pages

#### `app/page.tsx`
**Purpose**: Main homepage with infinite scroll book listing

**Features**:
- Server-side initial data loading
- Infinite scroll pagination
- Search integration
- Responsive layout

---

#### `app/book/[id]/page.tsx`
**Purpose**: Individual book detail page

**Route Parameters**:
- `id: string` - Book UUID

**Features**:
- Full book metadata
- Edition information
- Author links
- Cover images
- External IDs

---

#### `app/isbn/[isbn]/page.tsx`
**Purpose**: Book lookup by ISBN

**Route Parameters**:
- `isbn: string` - ISBN-13 identifier

**Features**:
- ISBN validation
- Book data retrieval
- Redirect to book page
- Error handling

---

### Author Pages

#### `app/authors/page.tsx`
**Purpose**: Authors listing with alphabetical navigation

**Features**:
- Alphabetical filtering
- Pagination
- Author statistics
- Search integration

---

#### `app/author/[id]/page.tsx`
**Purpose**: Individual author profile page

**Route Parameters**:
- `id: string` - Author UUID

**Features**:
- Author biography
- Complete bibliography
- External links
- Book grid display

---

### Admin Pages

#### `app/admin/duplicates/page.tsx`
**Purpose**: Admin interface for managing duplicate authors

**Features**:
- Duplicate detection controls
- Similarity scoring display
- Merge functionality
- Audit trail
- Batch operations

**Access**: Requires admin authentication

---

### Search Pages

#### `app/books/page.tsx`
**Purpose**: Search results page

**Query Parameters**:
- `q: string` - Search query

**Features**:
- Full-text search
- Result filtering
- Pagination
- Search refinement

---

## Custom Hooks

### `hooks/useInfiniteScroll.ts`
**Purpose**: Manages infinite scroll pagination

**Parameters**:
- `loadMore: () => Promise<T[]>` - Data fetching function
- `hasMore: boolean` - More data available flag

**Returns**:
- `data: T[]` - Accumulated data
- `loading: boolean` - Loading state
- `error: Error | null` - Error state
- `loadMoreRef: RefObject` - Intersection observer target

**Usage**:
```tsx
const { data, loading, loadMoreRef } = useInfiniteScroll({
  loadMore: fetchNextPage,
  hasMore: hasNextPage
});
```

---

### `hooks/useAuthorsInfiniteScroll.ts`
**Purpose**: Specialized infinite scroll for authors listing

**Parameters**:
- `letter?: string` - Alphabetical filter
- `pageSize?: number` - Items per page

**Returns**:
- `authors: Author[]` - Author list
- `loading: boolean` - Loading state
- `hasMore: boolean` - More data flag
- `loadMore: () => void` - Load more function

**Usage**:
```tsx
const { authors, loadMore, hasMore } = useAuthorsInfiniteScroll({
  letter: 'A',
  pageSize: 50
});
```

---

## Not Found Pages

### `app/book/[id]/not-found.tsx`
**Purpose**: 404 page for missing books

**Features**:
- User-friendly error message
- Navigation options
- Search prompt

---

### `app/author/[id]/not-found.tsx`
**Purpose**: 404 page for missing authors

**Features**:
- User-friendly error message
- Navigation options
- Author search prompt

---

## Component Best Practices

### State Management
- Use server components where possible for better performance
- Client components only when interactivity is required
- Leverage React Server Components for data fetching

### Performance
- Implement proper memoization for expensive computations
- Use dynamic imports for heavy components
- Optimize images with Next.js Image component

### Accessibility
- Proper ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Semantic HTML structure

### Testing
- Unit tests for utility functions
- Component testing with React Testing Library
- E2E tests for critical user flows

### Code Organization
```tsx
// Component file structure
import statements
type definitions
component function
  - hooks
  - state
  - effects
  - handlers
  - render
export statement
```

## Styling Patterns

### Tailwind CSS Classes
- Responsive design with breakpoint prefixes
- Dark mode support with `dark:` prefix
- Consistent spacing with Tailwind utilities
- Component-specific styles in separate CSS modules when needed

### Common Patterns
```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Card component
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">

// Loading state
<div className="flex items-center justify-center h-64">
  <LoadingSpinner />
</div>

// Error state
<div className="text-red-500 text-center p-4">
  Error: {error.message}
</div>
```

## Future Components

### Planned Enhancements
- `BookComparison` - Compare multiple editions
- `ReadingList` - User book collections
- `ReviewForm` - Book review submission
- `StatsDashboard` - Database statistics
- `ImportWizard` - Bulk book import

### Component Library
Consider extracting common components into a shared library:
- Form components
- Data display components
- Layout components
- Utility components

---

## Documentation Last Updated
Generated on 2025-09-14

## Related Documentation
- [Project Structure](./PROJECT_STRUCTURE.md) - Overall codebase organization
- [API Reference](./API_REFERENCE.md) - Backend API documentation
- [Development Guide](./DEVELOPMENT.md) - Component development workflow