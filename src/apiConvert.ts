import { ApiAuthor, ApiBook, ApiImage } from "./api";

export function getApiImage(image: Image): ApiImage {
    return {
        id: image.id,
        createAt: image.createAt.getTime(),
        updatedAt: image.updatedAt.getTime(),
        url: image.url,
        width: image.width,
        height: image.height,
    };
}

export function getApiAuthor(author: Author): ApiAuthor {
    return {
        id: author.id,
        createAt: author.createAt.getTime(),
        updatedAt: author.updatedAt.getTime(),
        name: author.name,
        akas: author.akas.slice(),
    };
}

export function getApiBook(book: Book): ApiBook {
    const authors = book.authors.map(a => getApiAuthor(a));
    const images = book.images.map(i => getApiImage(i));
    return {
        id: book.id,
        createAt: book.createAt.getTime(),
        updatedAt: book.updatedAt.getTime(),
        title: book.title,
        isbn13: book.isbn13,
        authors,
        longTitle: book.longTitle,
        description: book.description,
        synopsis: book.synopsis,
        publicationDate: book.publicationDate,
        images,
    };
}
