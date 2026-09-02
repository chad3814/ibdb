import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasTimeRemaining } from '../src/lib/timeBudget';

describe('hasTimeRemaining', () => {
    it('allows another item when the budget comfortably covers it', () => {
        assert.equal(hasTimeRemaining({ elapsedMs: 0, budgetMs: 50_000, nextItemMs: 1_000 }), true);
    });

    it('stops before the item would overrun the budget', () => {
        // The run must return a response rather than be killed mid-item, or the
        // claimed batch is stranded until releaseOldClaims picks it up.
        assert.equal(hasTimeRemaining({ elapsedMs: 49_500, budgetMs: 50_000, nextItemMs: 1_000 }), false);
    });

    it('treats an exactly-fitting item as too late', () => {
        assert.equal(hasTimeRemaining({ elapsedMs: 49_000, budgetMs: 50_000, nextItemMs: 1_000 }), false);
    });

    it('stops once the budget is already spent', () => {
        assert.equal(hasTimeRemaining({ elapsedMs: 60_000, budgetMs: 50_000, nextItemMs: 1 }), false);
    });
});
