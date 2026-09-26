# TerpDining frontend and native app

The same React UI runs in a browser and inside the iOS/Android Capacitor shell.
The native app calls the hosted Python API; Python and the database are not
bundled into the App Store download.

## Run and build

- `npm ci`: install the exact frontend versions recorded in `package-lock.json`.
- `npm run dev`: start Vite locally. `/api` is proxied to port 8000.
- `npm test`: check account return paths and HTTP error/cancellation behavior.
- `npm run lint`: check JavaScript/React mistakes.
- `npm run build`: create the production web bundle in `dist/`.
- `npx cap sync ios`: copy `dist/` and plugin configuration into the iOS project.
- `npx cap open ios`: open Xcode to build/run/archive the native app.

Build **before** syncing. Syncing does not rebuild or relaunch the installed app.
The production API URL comes from `VITE_API_URL` in `.env.production`.
Only public configuration belongs in `VITE_` variables: they are bundled into
the app and visible to users. Keep API keys and database credentials on the server.

## What each direct package does

### UI and styles

- `react`: components, state, and hooks used throughout `src/`.
- `react-dom`: mounts React into the page in `src/main.jsx`.
- `react-router-dom`: screen routes and in-app links in `src/App.jsx`.
- `react-markdown`: displays AI recipe replies as formatted text in `ChatMessage`.
  The recipe page loads on demand so this parser does not slow initial startup.
- `tailwindcss`: utility classes used to style components.
- `@tailwindcss/vite`: compiles those styles during development and production builds.

### Native bridge

- `@capacitor/core`: tells JavaScript whether it runs natively and calls native plugins.
- `@capacitor/ios`: iOS WebView container and bridge, built by Xcode.
- `@capacitor/android`: equivalent Android container, built by Android Studio.
- `@capacitor/cli`: the `cap sync` / `cap open` commands; not UI functionality.
- `@capacitor/browser`: opens nutrition links in an in-app browser sheet.
- `@capacitor/local-notifications`: schedules favorite-food alerts on the device.
  These are local notifications; the backend does not send push messages.
- `@capacitor/splash-screen`: hides the native launch screen once the web UI paints.

### Development tools

- `vite`: local server and production bundler.
- `@vitejs/plugin-react`: React compilation and fast refresh during development.
- `eslint`: checks source code without running the app.
- `@eslint/js`: ESLint's standard JavaScript rules.
- `eslint-plugin-react-hooks`: catches invalid hook usage and effect dependencies.
- `eslint-plugin-react-refresh`: checks exports for reliable development refresh.
- `globals`: teaches ESLint about browser globals such as `window` and `document`.
- `@types/react` / `@types/react-dom`: editor type information for React APIs,
  even though the app currently uses JavaScript rather than TypeScript.

## Where to look when changing behavior

- `src/api.js`: the only HTTP client. It adds the login token, bounds request waits,
  supports cancellation, and translates server validation errors to readable text.
- `src/context/AuthContext.jsx`: validates a saved login and manages sign-in/logout.
  A network failure preserves the token and offers retry or guest browsing.
- `src/context/NavigationStateContext.jsx`: remembers page choices across tab changes.
  `App.jsx` resets this provider when the user changes so private recipes do not leak.
- `src/components/AuthLink.jsx` / `AuthBackLink.jsx`: remember where an account flow
  began; Back returns there even after switching forms. Direct links return to Menu.
- `src/pages/MenuPage.jsx`: menus, hall/meal filters, favorites, and review dialogs.
  Changing the date cancels its previous request so old responses cannot overwrite it.
- `src/pages/RecipePage.jsx`: recipe prompts and saved conversations.
- `src/pages/TrackerPage.jsx`: daily food logs and macro goals.
- `src/lib/favoriteNotifications.js`: combines favorites into one alert per meal.
- `src/components/ExternalLink.jsx`: keeps external nutrition pages inside native UI.
- `capacitor.config.json`: app identity, build directory, and plugin settings.
- `ios/App/CapApp-SPM/Package.swift`: generated plugin wiring; let Capacitor update it.

## iOS release checks

After lint/build/sync, test on an iPhone: account cancellation, saved-login recovery
when offline, registration/password reset, account deletion, switching accounts,
menu dates, recipes, and notification permission changes. Rebuild in Xcode after
sync; a previously installed build will still have the old JavaScript.

An unsigned simulator/device build checks compilation, not App Store acceptance.
A distribution release still needs your Apple team, signing, archive validation,
App Store Connect privacy answers, and physical-device testing.
