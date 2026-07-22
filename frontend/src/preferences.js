// Device-level preferences (localStorage, no account required).
const PREFERRED_HALL_KEY = 'preferred_hall';

export function getPreferredHall() {
  return localStorage.getItem(PREFERRED_HALL_KEY) || '';
}

export function setPreferredHall(hall) {
  if (hall) localStorage.setItem(PREFERRED_HALL_KEY, hall);
  else localStorage.removeItem(PREFERRED_HALL_KEY);
}
