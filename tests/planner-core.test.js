import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  calculateAverageCosts,
  calculateTripDays,
  climateBucket,
  getWeekdayPtBr,
  similarDayScore,
} from '../src/planner-core.js';

test('calculateTripDays returns day diff', () => {
  assert.equal(calculateTripDays('2026-07-10', '2026-07-15'), 5);
});

test('addDays moves ISO day', () => {
  assert.equal(addDays('2026-07-10', 2), '2026-07-12');
});

test('weekday in pt-BR with timezone', () => {
  const weekday = getWeekdayPtBr('2026-07-14', 'Europe/Lisbon');
  assert.equal(typeof weekday, 'string');
  assert.ok(weekday.length > 2);
});

test('climate buckets', () => {
  assert.equal(climateBucket(31), 'warm');
  assert.equal(climateBucket(10), 'cold');
  assert.equal(climateBucket(20), 'mild');
  assert.equal(climateBucket(null), 'fallback');
});

test('similar day score weighted', () => {
  const score = similarDayScore({
    climateMatch: 1,
    sameWeekday: 1,
    positionMatch: 0.8,
    destinationTypeMatch: 0.7,
    tripLengthMatch: 1,
  });
  assert.equal(Number(score.toFixed(3)), 0.925);
});

test('average costs aggregate correctly', () => {
  const out = calculateAverageCosts({ transport_avg_per_day: 20, food_avg_per_day: 30, confidence: 0.8 }, 4);
  assert.deepEqual(out, { transport: 80, food: 120, total: 200, confidence: 0.8 });
});
