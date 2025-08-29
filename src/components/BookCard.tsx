'use client';

import { BookCardProps } from '@/types/home';
import Image from 'next/image';
import Link from 'next/link';
import styles from './BookCard.module.css';

export default function BookCard({ book }: BookCardProps) {
    const displayTitle = book.longTitle || book.title;
    const authorNames = book.authors.map(author => author.name).join(', ');
    const displayImage = book.image;
    
    // Fallback image dimensions
    const imageWidth = displayImage?.width || 120;
    const imageHeight = displayImage?.height || 180;
    
    // Calculate aspect ratio for responsive images
    const aspectRatio = imageHeight / imageWidth;

    return (
        <article className={styles.card} role="article">
            <Link 
                href={`/book/${book.id}`} 
                className={styles.cardLink}
                aria-label={`View details for ${displayTitle} by ${authorNames}`}
            >
                <div className={styles.imageContainer}>
                    {displayImage ? (
                        <Image
                            src={displayImage.url}
                            alt={`Cover of ${displayTitle}`}
                            width={imageWidth}
                            height={imageHeight}
                            className={styles.bookImage}
                            sizes="(max-width: 480px) 150px, (max-width: 768px) 180px, 200px"
                            style={{
                                aspectRatio: `${imageWidth}/${imageHeight}`,
                            }}
                            priority={false}
                        />
                    ) : (
                        <div 
                            className={styles.placeholderImage}
                            style={{ aspectRatio: aspectRatio }}
                            role="img"
                            aria-label="No cover image available"
                        >
                            <span className={styles.placeholderText}>No Image</span>
                        </div>
                    )}
                </div>
                
                <div className={styles.content}>
                    <h2 className={styles.title}>
                        {displayTitle}
                    </h2>
                    
                    {authorNames && (
                        <p className={styles.authors}>
                            by {authorNames}
                        </p>
                    )}
                    
                    {book.synopsis && (
                        <p className={styles.synopsis}>
                            {book.synopsis}
                        </p>
                    )}
                    
                    <div className={styles.metadata}>
                        {book.publicationDate && (
                            <span className={styles.publicationDate}>
                                {book.publicationDate}
                            </span>
                        )}
                        {book.publisher && (
                            <span className={styles.publisher}>
                                {book.publisher}
                            </span>
                        )}
                        {book.binding && book.binding !== 'Unknown' && (
                            <span className={styles.binding}>
                                {book.binding}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
        </article>
    );
}