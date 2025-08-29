type MissingError = {
    status: 'error';
    message: string;
};
type MissingSuccess = {
    status: 'ok';
    missing: MissingInfo[];
    total: number;
};
type MissingInfoBase = {
    editionId: string;
    bookId: string;
    title: string;
    isbn13: string;
};
type MissingInfoHardcover = {
    bookHardcoverId: number|null;
    bookHardcoverSlug?: string|null;
    authors: AuthorInfoHardcover[];
};
type MissingInfoOpenLibrary = {
    bookOpenLibraryId: string|null;
    authors: AuthorInfoOpenLibrary[];
};
type MissingInfoGoodReads = {
    bookGoodReadsId: string|null;
    authors: AuthorInfoGoodReads[];
};
type MissingInfo = MissingInfoBase & (MissingInfoHardcover | MissingInfoOpenLibrary | MissingInfoGoodReads);

type AuthorInfoBase = {
    id: string;
    name: string;
};
type AuthorInfoHardcover = AuthorInfoBase & {
    hardcoverId: number|null;
    hardcoverSlug?: string|null;
};

type AuthorInfoOpenLibrary = AuthorInfoBase & {
    openLibraryId: string|null;
};
type AuthorInfoGoodReads = AuthorInfoBase & {
    goodReadsId: string|null;
};

type MissingResponse = MissingError | MissingSuccess;
type ExternalId = 'hardcoverId' | 'openLibraryId' | 'goodReadsId';

type MissingPostError = {
    status: 'error';
    message: string;
};
type MissingPostSuccess = {
    status: 'ok';
};
type MissingPostResponse = MissingPostError | MissingPostSuccess;

type MissingPostBody = {
    edition: {
        id: string;
        hardcoverId?: number;
        openLibraryId?: string;
        goodReadsId?: string;
    },
    book: {
        id: string;
        hardcoverId?: number|null;
        openLibraryId?: string|null;
        goodReadsId?: string|null;
        hardcoverSlug?: string|null;
    },
    authors: {
        id: string;
        hardcoverId?: number|null;
        openLibraryId?: string|null;
        goodReadsId?: string|null;
        hardcoverSlug?: string|null;
    }[];
};

export type { MissingResponse, MissingInfo, ExternalId, MissingPostBody, MissingPostResponse };
