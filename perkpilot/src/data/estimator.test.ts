import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePoints } from './estimator';

test('hyatt fixed chart returns exact value with HIGH confidence', () => {
  const e = estimatePoints('hyatt', 400, { hyattCategory: 4, hyattTier: 'standard' });
  assert.equal(e.confidence, 'HIGH');
  assert.deepEqual(e.range, [15000, 15000]);
});

test('dynamic program returns a range where low <= high', () => {
  const e = estimatePoints('bonvoy', 300, { estTaxesFees: 0 });
  assert.equal(e.confidence, 'MEDIUM');
  assert.ok(e.range[0] <= e.range[1]);
  // expensive points (cpp_high) -> fewer needed -> low end
  assert.ok(e.range[0] > 0);
});

test('revenue-based program tracks the cash fare', () => {
  const e = estimatePoints('southwest', 140);
  assert.equal(e.confidence, 'MEDIUM-HIGH');
  assert.ok(e.range[0] > 0 && e.range[0] === e.range[1]);
});
