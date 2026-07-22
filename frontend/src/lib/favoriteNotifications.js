import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { MEAL_HOURS } from '../mealHours';

const SENT_KEY = 'favorite_notifications_sent_v1';

function loadSent() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSent(sent) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
  } catch {
    /* ignore quota errors */
  }
}

// Stable positive 32-bit id the plugin requires, derived from the dedupe key.
function idFor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2147483647;
}

function openTimeFor(meal, dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const startHour = MEAL_HOURS[meal]?.[0] ?? 12;
  const at = new Date(year, month - 1, day, Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
  const now = new Date();
  // Meal period already started today: fire almost immediately instead of in the past.
  return at > now ? at : new Date(now.getTime() + 5000);
}

function combineNames(names) {
  if (names.length === 1) return `${names[0]} is now available`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are now available`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are now available`;
}

// Schedules one local notification per (hall, meal) where a favorited item is on today's
// menu, combining multiple favorites at the same meal into a single notification, and
// skipping any (date, hall, meal) combo already scheduled so reopening the app never
// re-sends. Only meaningful for today's menu, since that's the only day a "the hall just
// opened" notification makes sense for.
export async function scheduleFavoriteNotifications({ data, favorites, date, isToday }) {
  if (!isToday || !data || !favorites || favorites.size === 0) return;
  if (!Capacitor.isNativePlatform()) return;

  const byHallMeal = new Map();
  for (const [hall, meals] of Object.entries(data.halls)) {
    for (const [meal, stations] of Object.entries(meals)) {
      for (const items of Object.values(stations)) {
        for (const item of items) {
          if (!favorites.has(item.name)) continue;
          const key = `${hall}|${meal}`;
          if (!byHallMeal.has(key)) byHallMeal.set(key, { hall, meal, names: new Set() });
          byHallMeal.get(key).names.add(item.name);
        }
      }
    }
  }
  if (byHallMeal.size === 0) return;

  const sent = loadSent();
  const pending = [...byHallMeal.values()].filter(
    ({ hall, meal }) => !sent.has(`${date}|${hall}|${meal}`)
  );
  if (pending.length === 0) return;

  try {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }
  } catch {
    return;
  }

  const notifications = pending.map(({ hall, meal, names }) => {
    const dedupeKey = `${date}|${hall}|${meal}`;
    sent.add(dedupeKey);
    return {
      id: idFor(dedupeKey),
      title: '🍽️ Your favorite is being served!',
      body: `${combineNames([...names])} at ${hall}.`,
      schedule: { at: openTimeFor(meal, date) },
    };
  });

  try {
    await LocalNotifications.schedule({ notifications });
    saveSent(sent);
  } catch {
    /* ignore scheduling failure, e.g. permission revoked mid-flight */
  }
}
