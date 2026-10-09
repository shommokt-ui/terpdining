import { MEAL_HOURS } from '../mealHours.js';

export function defaultMenuMeal(meals, now = new Date()) {
  if (meals.length === 0) return null;

  const hour = now.getHours() + now.getMinutes() / 60;
  const timed = meals
    .filter((meal) => MEAL_HOURS[meal])
    .map((meal) => ({ meal, start: MEAL_HOURS[meal][0], end: MEAL_HOURS[meal][1] }));

  // If serving windows overlap, show the meal that started most recently.
  const serving = timed.filter(({ start, end }) => hour >= start && hour < end);
  if (serving.length) return serving.reduce((latest, meal) => meal.start > latest.start ? meal : latest).meal;

  const upcoming = timed.filter(({ start }) => start > hour);
  if (upcoming.length) return upcoming.reduce((next, meal) => meal.start < next.start ? meal : next).meal;

  // After closing, leave the last available meal visible.
  if (timed.length) return timed.reduce((latest, meal) => meal.start > latest.start ? meal : latest).meal;
  return meals[0];
}
