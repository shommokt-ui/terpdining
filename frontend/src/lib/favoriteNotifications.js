import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { MEAL_HOURS } from '../mealHours';

const SENT_KEY = 'favorite_notifications_sent_v1';
const PREF_KEY = 'favorite_notifications_pref';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

// Unset means "not asked yet" so the UI knows to ask; only an explicit 'on' enables scheduling.
export function getNotifyPref() {
  return localStorage.getItem(PREF_KEY);
}

export function setNotifyPref(on) {
  localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
}

// Asks the OS for notification permission. Returns true only if the user granted it.
export async function requestNotifyPermission() {
  try {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display === 'granted') return true;
    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch {
    return false;
  }
}

// Turning notifications off cancels anything already queued for later today.
export async function cancelPendingFavoriteNotifications() {
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) await LocalNotifications.cancel({ notifications });
  } catch {
    /* ignore */
  }
  localStorage.removeItem(SENT_KEY);
}

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

// Returns the meal's opening time, or null if the hall already opened for that meal —
// notifications only fire at opening, never retroactively mid-meal.
function openTimeFor(meal, dateStr) {
  const startHour = MEAL_HOURS[meal]?.[0];
  if (startHour == null) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const at = new Date(year, month - 1, day, Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
  return at > new Date() ? at : null;
}

function listJoin(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

// itemHalls: Map<item name, Set<hall>>
function describeMeal(itemHalls) {
  const entries = [...itemHalls.entries()];
  if (entries.length === 1) {
    const [name, halls] = entries[0];
    return `${name} is now available at ${listJoin([...halls])}.`;
  }
  return `Now being served: ${entries.map(([name, halls]) => `${name} (${listJoin([...halls])})`).join(', ')}.`;
}

// Schedules one local notification per meal where favorited items are on today's menu —
// all favorites and all halls serving them are combined into that single notification,
// so an item served at every hall still produces only one alert. A (date, meal) combo
// already scheduled is skipped so reopening the app never re-sends. Only meaningful for
// today's menu, since that's the only day a "the hall just opened" notification makes
// sense for.
export async function scheduleFavoriteNotifications({ data, favorites, date, isToday }) {
  if (!isToday || !data || !favorites || favorites.size === 0) return;
  if (!Capacitor.isNativePlatform()) return;
  if (getNotifyPref() !== 'on') return;

  // meal -> Map<item name, Set<hall>>
  const byMeal = new Map();
  for (const [hall, meals] of Object.entries(data.halls)) {
    for (const [meal, stations] of Object.entries(meals)) {
      for (const items of Object.values(stations)) {
        for (const item of items) {
          if (!favorites.has(item.name)) continue;
          if (!byMeal.has(meal)) byMeal.set(meal, new Map());
          const itemHalls = byMeal.get(meal);
          if (!itemHalls.has(item.name)) itemHalls.set(item.name, new Set());
          itemHalls.get(item.name).add(hall);
        }
      }
    }
  }
  if (byMeal.size === 0) return;

  const sent = loadSent();
  const pending = [...byMeal.entries()]
    .map(([meal, itemHalls]) => ({ meal, itemHalls, at: openTimeFor(meal, date) }))
    .filter(({ meal, at }) => at !== null && !sent.has(`${date}|${meal}`));
  if (pending.length === 0) return;

  // Permission was granted when the user opted in; re-check silently in case it was
  // revoked in Settings since, but never pop the OS prompt from here.
  try {
    const perms = await LocalNotifications.checkPermissions();
    if (perms.display !== 'granted') return;
  } catch {
    return;
  }

  const notifications = pending.map(({ meal, itemHalls, at }) => {
    const dedupeKey = `${date}|${meal}`;
    sent.add(dedupeKey);
    return {
      id: idFor(dedupeKey),
      title: itemHalls.size === 1 ? 'Your favorite is being served!' : 'Your favorites are being served!',
      body: describeMeal(itemHalls),
      schedule: { at },
    };
  });

  try {
    await LocalNotifications.schedule({ notifications });
    saveSent(sent);
  } catch {
    /* ignore scheduling failure, e.g. permission revoked mid-flight */
  }
}
