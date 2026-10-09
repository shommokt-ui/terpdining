import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMenuMeal } from '../src/lib/defaultMenuMeal.js';

const at = (hour, minute = 0) => new Date(2026, 9, 9, hour, minute);

test('defaults to the meal currently being served', () => {
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  assert.equal(defaultMenuMeal(meals, at(8)), 'Breakfast');
  assert.equal(defaultMenuMeal(meals, at(12)), 'Lunch');
  assert.equal(defaultMenuMeal(meals, at(18)), 'Dinner');
});

test('chooses the newer meal when serving windows overlap', () => {
  assert.equal(defaultMenuMeal(['Brunch', 'Lunch'], at(11)), 'Lunch');
  assert.equal(defaultMenuMeal(['Brunch', 'Lunch'], at(10)), 'Brunch');
});

test('chooses the next meal between windows and the last meal after closing', () => {
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  assert.equal(defaultMenuMeal(meals, at(6)), 'Breakfast');
  assert.equal(defaultMenuMeal(meals, at(16, 15)), 'Dinner');
  assert.equal(defaultMenuMeal(meals, at(22)), 'Dinner');
});

test('uses only meals available at the selected hall', () => {
  assert.equal(defaultMenuMeal(['Brunch', 'Dinner'], at(12)), 'Brunch');
  assert.equal(defaultMenuMeal([], at(12)), null);
});
