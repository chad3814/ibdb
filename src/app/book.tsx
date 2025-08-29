'use client';

import { ApiBook } from "@/api";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import styles from "./book.module.css";

type Props = {
    book: ApiBook;
};

function ExternalLinks({ book }: { book: ApiBook }) {
    const links = [];
    
    if (book.goodReadsId) {
        links.push({
            name: 'Goodreads',
            url: `https://www.goodreads.com/book/show/${book.goodReadsId}`,
            icon: '📚',
            external: true
        });
    }
    
    if (book.openLibraryId) {
        links.push({
            name: 'Open Library',
            url: `https://openlibrary.org/books/${book.openLibraryId}`,
            icon: '📖',
            external: true
        });
    }
    
    if (book.hardcoverId && book.hardcoverSlug) {
        links.push({
            name: 'Hardcover',
            url: `https://hardcover.app/books/${book.hardcoverSlug}`,
            icon: '📕',
            external: true
        });
    }
    
    if (links.length === 0) return null;
    
    return (
        <div className={styles.externalLinks}>
            <h3>Find this book on:</h3>
            <div className={styles.linkGrid}>
                {links.map((link) => (
                    <a
                        key={link.name}
                        href={link.url}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className={styles.externalLink}
                        aria-label={link.external ? `View this book on ${link.name}` : `View ${link.name}`}
                    >
                        <span className={styles.linkIcon} aria-hidden="true">{link.icon}</span>
                        {link.name}
                    </a>
                ))}
            </div>
        </div>
    );
}

function EditionsList({ editions }: { editions: ApiBook['editions'] }) {
    if (editions.length <= 1) return null;
    
    const [showAllEditions, setShowAllEditions] = useState(false);
    const displayedEditions = showAllEditions ? editions : editions.slice(0, 3);
    
    return (
        <div className={styles.editions}>
            <h3>Other Editions</h3>
            <div className={styles.editionsList}>
                {displayedEditions.map((edition) => (
                    <div key={edition.id} className={styles.edition}>
                        <div className={styles.editionInfo}>
                            {edition.editionName && (
                                <div className={styles.editionName}>{edition.editionName}</div>
                            )}
                            <div className={styles.editionDetails}>
                                <span className={styles.binding}>{edition.binding}</span>
                                {edition.publicationDate && (
                                    <span className={styles.pubDate}>{edition.publicationDate}</span>
                                )}
                                {edition.publisher && (
                                    <span className={styles.publisher}>{edition.publisher}</span>
                                )}
                            </div>
                            <div className={styles.isbn} title="ISBN-13">
                                {edition.isbn13}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {editions.length > 3 && (
                <button
                    onClick={() => setShowAllEditions(!showAllEditions)}
                    className={styles.toggleEditions}
                    aria-expanded={showAllEditions}
                >
                    {showAllEditions ? 'Show fewer editions' : `Show all ${editions.length} editions`}
                </button>
            )}
        </div>
    );
}

export default function BookDetail({ book }: Props) {
    const [imageError, setImageError] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(true);
    
    const title = book.longTitle || book.title;
    const authorsText = book.authors.map(a => a.name).join(', ');
    
    return (
        <div className={styles.container}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                <Link href="/" className={styles.breadcrumbLink}>
                    Home
                </Link>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">›</span>
                <span className={styles.breadcrumbCurrent} aria-current="page">Book Details</span>
            </nav>
            
            <main className={styles.main}>
                <div className={styles.hero}>
                    <div className={styles.coverSection}>
                        <div className={styles.coverContainer}>
                            {book.image && !imageError ? (
                                <Image
                                    src={book.image.url}
                                    alt={title}
                                    width={book.image.width}
                                    height={book.image.height}
                                    className={`${styles.cover} ${isImageLoading ? styles.loading : ''}`}
                                    onLoad={() => setIsImageLoading(false)}
                                    onError={() => {
                                        setImageError(true);
                                        setIsImageLoading(false);
                                    }}
                                    priority
                                />
                            ) : (
                                <div className={styles.coverPlaceholder}>
                                    <div className={styles.placeholderContent}>
                                        <div className={styles.placeholderIcon} aria-hidden="true">📖</div>
                                        <div className={styles.placeholderText}>No Cover Available</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className={styles.bookInfo}>
                        <header className={styles.bookHeader}>
                            <h1 className={styles.title}>{title}</h1>
                            <div className={styles.authorLine}>
                                <span className={styles.byText}>by</span>
                                <span className={styles.authors}>
                                    {book.authors.map((author, index) => (
                                        <span key={author.id}>
                                            <Link href={`/author/${author.id}`} className={styles.authorLink}>
                                                {author.name}
                                            </Link>
                                            {index < book.authors.length - 1 && ', '}
                                        </span>
                                    ))}
                                </span>
                            </div>
                        </header>
                        
                        <div className={styles.quickInfo}>
                            <div className={styles.quickInfoItem}>
                                <span className={styles.quickInfoLabel}>Format:</span>
                                <span className={styles.quickInfoValue}>{book.binding}</span>
                            </div>
                            {book.publicationDate && (
                                <div className={styles.quickInfoItem}>
                                    <span className={styles.quickInfoLabel}>Published:</span>
                                    <span className={styles.quickInfoValue}>{book.publicationDate}</span>
                                </div>
                            )}
                            {book.publisher && (
                                <div className={styles.quickInfoItem}>
                                    <span className={styles.quickInfoLabel}>Publisher:</span>
                                    <span className={styles.quickInfoValue}>{book.publisher}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className={styles.content}>
                    <div className={styles.mainContent}>
                        {book.synopsis && (
                            <section className={styles.synopsis} aria-labelledby="synopsis-heading">
                                <h2 id="synopsis-heading" className={styles.sectionTitle}>Synopsis</h2>
                                <div className={styles.synopsisText}>{book.synopsis}</div>
                            </section>
                        )}
                        
                        <EditionsList editions={book.editions} />
                    </div>
                    
                    <aside className={styles.sidebar}>
                        <section className={styles.metadata} aria-labelledby="details-heading">
                            <div className={styles.metadataHeader}>
                                <h2 id="details-heading" className={styles.sectionTitle}>Book Details</h2>
                                <a 
                                    href={`/book/${book.id}.json`}
                                    className={styles.jsonButton}
                                    title="View JSON data"
                                    aria-label="View book data as JSON"
                                >
                                    {`{}`}
                                </a>
                            </div>
                            <dl className={styles.metadataList}>
                                <div className={styles.metadataItem}>
                                    <dt className={styles.metadataLabel}>ISBN-13:</dt>
                                    <dd className={styles.metadataValue}>{book.isbn13}</dd>
                                </div>
                                <div className={styles.metadataItem}>
                                    <dt className={styles.metadataLabel}>Format:</dt>
                                    <dd className={styles.metadataValue}>{book.binding}</dd>
                                </div>
                                {book.publicationDate && (
                                    <div className={styles.metadataItem}>
                                        <dt className={styles.metadataLabel}>Publication Date:</dt>
                                        <dd className={styles.metadataValue}>{book.publicationDate}</dd>
                                    </div>
                                )}
                                {book.publisher && (
                                    <div className={styles.metadataItem}>
                                        <dt className={styles.metadataLabel}>Publisher:</dt>
                                        <dd className={styles.metadataValue}>{book.publisher}</dd>
                                    </div>
                                )}
                                <div className={styles.metadataItem}>
                                    <dt className={styles.metadataLabel}>Authors:</dt>
                                    <dd className={styles.metadataValue}>{authorsText}</dd>
                                </div>
                                {book.editions.length > 1 && (
                                    <div className={styles.metadataItem}>
                                        <dt className={styles.metadataLabel}>Editions:</dt>
                                        <dd className={styles.metadataValue}>{book.editions.length} available</dd>
                                    </div>
                                )}
                            </dl>
                        </section>
                        
                        <ExternalLinks book={book} />
                        
                        <section className={styles.shareSection} aria-labelledby="share-heading">
                            <h3 id="share-heading" className={styles.sectionTitle}>Share</h3>
                            <button
                                onClick={() => {
                                    if (navigator.share) {
                                        navigator.share({
                                            title: title,
                                            text: `Check out "${title}" by ${authorsText}`,
                                            url: window.location.href,
                                        });
                                    } else {
                                        navigator.clipboard.writeText(window.location.href);
                                    }
                                }}
                                className={styles.shareButton}
                                aria-label="Share this book"
                            >
                                <span aria-hidden="true">🔗</span>
                                Share Book
                            </button>
                        </section>
                    </aside>
                </div>
            </main>
        </div>
    );
}