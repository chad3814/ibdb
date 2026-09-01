import type { MetadataRoute } from 'next';

/**
 * `/isbn/*`, `/books` and `/search` reach ISBNdb on a cache miss, and every
 * miss is a billed request. Book and author pages are served from our own
 * database, so those stay indexable.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/api/',
                    '/isbn/',
                    '/isbn-json/',
                    '/books',
                    '/search',
                    '/admin/',
                ],
            },
        ],
    };
}
