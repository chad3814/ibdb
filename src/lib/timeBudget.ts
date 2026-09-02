type Budget = {
    elapsedMs: number;
    budgetMs: number;
    nextItemMs: number;
};

/**
 * Whether one more item fits in the run's wall-clock budget.
 *
 * The run must finish on its own terms rather than be killed mid-item: a killed
 * invocation strands its claimed batch until releaseOldClaims recovers it.
 */
export function hasTimeRemaining({ elapsedMs, budgetMs, nextItemMs }: Budget): boolean {
    return elapsedMs + nextItemMs < budgetMs;
}
