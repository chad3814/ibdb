import sanitizeHtml from 'sanitize-html';

export function sanitizeSynopsis(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: ['b', 'br', 'i'],
        allowedAttributes: {},
    });
}

export function stripHtmlTags(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: [],
        allowedAttributes: {},
    });
}
