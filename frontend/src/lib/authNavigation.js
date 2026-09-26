const guestPages = new Set(['/menu', '/recipe', '/tracker', '/settings', '/privacy', '/terms']);

// Keep the original page while switching account forms. A direct link has no
// origin, so Back opens the menu instead of leaving the app or looping forms.
export function authReturnTo(location) {
  if (guestPages.has(location.pathname)) return location.pathname;
  return guestPages.has(location.state?.returnTo) ? location.state.returnTo : '/menu';
}
