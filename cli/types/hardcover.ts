// Types for Hardcover GraphQL API responses

export interface HardcoverAuthor {
    id: number;
    name: string;
    slug: string;
}

export interface HardcoverContribution {
    author: HardcoverAuthor;
}

export interface HardcoverBook {
    id: number;
    title: string;
    slug: string;
    contributions: HardcoverContribution[];
}

export interface HardcoverEdition {
    id: number;
    isbn_13: string;
    book: HardcoverBook;
}

export interface HardcoverQueryVariables {
    title?: string;
    name?: string;
    isbn?: string;
}

export interface HardcoverQueryResponse {
    data: {
        editions: HardcoverEdition[];
    };
    errors?: Array<{
        message: string;
        extensions?: Record<string, unknown>;
    }>;
}

// Helper function to make the GraphQL query
export async function queryHardcover(
    variables: HardcoverQueryVariables,
    token: string
): Promise<HardcoverQueryResponse> {
    const query = `
        query MyQuery($title: String, $name: String, $isbn: String) {
            editions(
                where: {
                    title: {_eq: $title},
                    edition_format: {_is_null: false},
                    contributions: {author: {name: {_eq: $name}}},
                    isbn_13: {_eq: $isbn}
                }
            ) {
                id
                isbn_13
                book {
                    id
                    title
                    slug
                    contributions {
                        author {
                            id
                            name
                            slug
                        }
                    }
                }
            }
        }
    `;

    const response = await fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        throw new Error(`Hardcover API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<HardcoverQueryResponse>;
}