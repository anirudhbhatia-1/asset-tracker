// Applies the saved dark theme before the page paints, so dark-mode users
// don't see a white flash. A separate file (not inline) so the site's
// Content-Security-Policy ('self') allows it. Kept tiny and blocking on purpose.
try {
  if (localStorage.getItem('assettrack-theme') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch (e) { /* storage blocked: stay light */ }
