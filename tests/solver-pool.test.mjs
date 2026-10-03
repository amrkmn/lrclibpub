import assert from 'node:assert/strict';
// Pure pool-math tests (node:test, zero deps). Run: nub run test
import { describe, it } from 'node:test';

import {
    isCurrentJob,
    resolveWorkerCount,
    shouldFail,
    sumAttempts,
    sumRate,
    workerAssignments
} from '../src/lib/solver-pool.ts';

describe('resolveWorkerCount', () => {
    it('clamps to [1, 8]', () => {
        assert.equal(resolveWorkerCount(0), 1);
        assert.equal(resolveWorkerCount(4), 4);
        assert.equal(resolveWorkerCount(16), 8);
    });

    it('defaults nullish to 4', () => {
        assert.equal(resolveWorkerCount(null), 4);
        assert.equal(resolveWorkerCount(undefined), 4);
    });
});

describe('workerAssignments', () => {
    it('covers disjoint nonces', () => {
        assert.deepEqual(workerAssignments(4), [
            { startNonce: 0, stride: 4 },
            { startNonce: 1, stride: 4 },
            { startNonce: 2, stride: 4 },
            { startNonce: 3, stride: 4 }
        ]);
    });

    it('single worker starts at 0 with stride 1', () => {
        assert.deepEqual(workerAssignments(1), [{ startNonce: 0, stride: 1 }]);
    });
});

describe('sumAttempts', () => {
    it('sums and floors', () => {
        assert.equal(sumAttempts([{ attempts: 10 }, { attempts: 20.7 }]), 30);
    });

    it('clamps negatives and handles empty', () => {
        assert.equal(sumAttempts([{ attempts: -5 }, { attempts: 7 }]), 7);
        assert.equal(sumAttempts([]), 0);
    });
});

describe('sumRate', () => {
    it('sums rates', () => {
        assert.equal(sumRate([{ rate: 100 }, { rate: 250 }]), 350);
    });

    it('empty pool reports 0', () => {
        assert.equal(sumRate([]), 0);
    });
});

describe('isCurrentJob', () => {
    it('accepts only the active jobId', () => {
        assert.equal(isCurrentJob(3, 3), true);
        assert.equal(isCurrentJob(2, 3), false);
        assert.equal(isCurrentJob(undefined, 3), false);
    });
});

describe('shouldFail', () => {
    it('fails only on unanimous errors', () => {
        assert.equal(shouldFail(1, 8), false);
        assert.equal(shouldFail(7, 8), false);
        assert.equal(shouldFail(8, 8), true);
    });

    it('single-worker pool fails on its only error', () => {
        assert.equal(shouldFail(1, 1), true);
    });
});
