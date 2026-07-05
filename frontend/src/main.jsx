import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Once the app has painted its first frame, drop the inline boot splash and,
// on native, hide the native splash screen (kept up via launchAutoHide: false
// so users never see a blank/black gap while the WebView boots).
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('app-splash')?.remove();
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(() => {});
    }
  });
});
