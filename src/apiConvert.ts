import { ApiAuthor, ApiBook, ApiImage } from "./api";
import { Image, Author, Book, Binding } from "./server/db";

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
    };
}

export type FullBook = Book & { authors: Author[] } & { image?: Image | null };

export function getApiBook(book: FullBook): ApiBook {
    const authors = book.authors.map(a => getApiAuthor(a));
    let image: ApiImage|undefined;
    if (book.image) {
        image = getApiImage(book.image);
    }
    let binding: 'Unknown'|'Hardcover'|'Paperback'|'Ebook'|'Audiobook' = 'Unknown';
    switch (book.binding) {
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
    return {
        id: book.id,
        createdAt: book.createdAt.getTime(),
        updatedAt: book.updatedAt.getTime(),
        title: book.title,
        isbn13: book.isbn13,
        authors,
        longTitle: book.longTitle,
        synopsis: book.synopsis,
        publicationDate: book.publicationDate,
        publisher: book.publisher,
        binding,
        image,
    };
}
