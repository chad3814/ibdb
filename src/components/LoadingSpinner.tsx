'use client';

import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

export default function LoadingSpinner({ 
    size = 'medium', 
    className = '' 
}: LoadingSpinnerProps) {
    return (
        <div 
            className={`${styles.spinner} ${styles[size]} ${className}`}
            role="status"
            aria-label="Loading"
        >
            <div className={styles.bounce1}></div>
            <div className={styles.bounce2}></div>
            <div className={styles.bounce3}></div>
            <span className="sr-only">Loading...</span>
        </div>
    );
}