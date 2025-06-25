import { ApiAuthor, ApiBinding, ApiBook, ApiEdition, ApiImage } from "./api";
import { Image, Author, Edition, Book, Binding } from "./server/db";

export function getApiImage(image: Image): ApiImage {
    return {
        id: image.id,
        createdAt: image.createdAt.getTime(),
        updatedAt: image.updatedAt.getTime(),
        url: image.url,
        width: image.width,
        height: image.height,
    };
}

export function getApiAuthor(author: Author): ApiAuthor {
    return {
        id: author.id,
        createdAt: author.createdAt.getTime(),
        updatedAt: author.updatedAt.getTime(),
        name: author.name,
        openLibraryId: author.openLibraryId ?? null,
        goodReadsId: author.goodReadsId ?? null,
        hardcoverId: author.hardcoverId ?? null,
        hardcoverSlug: author.hardcoverSlug ?? null,
    };
}

export type FullBook = Book & { authors: Author[] } & { editions: (Edition &{ image?: Image | null })[]};

export function getApiEdition(edition: Edition): ApiEdition {
    return {
        id: edition.id,
        createdAt: edition.createdAt.getTime(),
        updatedAt: edition.updatedAt.getTime(),
        bookId: edition.bookId,
        editionName: edition.editionName ?? null,
        isbn13: edition.isbn13,
        binding: edition.binding as ApiBinding,
        openLibraryId: edition.openLibraryId ?? null,
        goodReadsId: edition.goodReadsId ?? null,
        hardcoverId: edition.hardcoverId ?? null,
    };
}

export function getApiBook(book: FullBook): ApiBook {
    const authors = book.authors.map(a => getApiAuthor(a));
    let image: ApiImage|undefined;
    
    let binding: ApiBinding = 'Unknown';
    let isbn13: string = '';
    let publicationDate: string | null = null;
    let publisher: string | null = null;
    if (book.editions.length > 0) {
        const edition = book.editions[0];
        switch (edition.binding) {
            case Binding.Audiobook:
                binding = 'Audiobook';
                break;
            case Binding.Ebook:
                binding = 'Ebook';
                break;
            case Binding.Hardcover:
                binding = 'Hardcover';
                break;
            case Binding.Paperback:
                binding = 'Paperback';
                break;
        }
        isbn13 = edition.isbn13;
        publicationDate = edition.publicationDate ?? null;
        publisher = edition.publisher ?? null;
        if (edition.image) {
            image = getApiImage(edition.image);
        }
    }
    const editions = book.editions.map(e => getApiEdition(e));

    return {
        id: book.id,
        createdAt: book.createdAt.getTime(),
        updatedAt: book.updatedAt.getTime(),
        title: book.title,
        isbn13,
        authors,
        longTitle: book.longTitle,
        synopsis: book.synopsis,
        publicationDate,
        publisher,
        binding,
        editions,
        image,
        hardcoverId: book.hardcoverId ?? null,
        openLibraryId: book.openLibraryId ?? null,
        goodReadsId: book.goodReadsId ?? null,
        hardcoverSlug: book.hardcoverSlug ?? null,
    };
}
