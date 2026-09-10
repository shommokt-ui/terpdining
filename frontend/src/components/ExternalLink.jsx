import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// A normal <a> on the web (new tab, cmd-click, etc). Inside the native app a
// bare target="_blank" ejects the user to Safari; there we intercept and open
// an in-app SFSafariViewController / Custom Tab sheet they can swipe away.
export default function ExternalLink({ href, children, onClick, ...rest }) {
  function handleClick(e) {
    onClick?.(e);
    if (e.defaultPrevented || !href) return;
    if (Capacitor.isNativePlatform()) {
      e.preventDefault();
      Browser.open({ url: href }).catch(() => {
        window.open(href, '_blank', 'noopener,noreferrer');
      });
    }
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
