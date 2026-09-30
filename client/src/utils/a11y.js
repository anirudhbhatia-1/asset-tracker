/**
 * Keyboard support for clickable non-button elements (table rows, cards):
 * returns an onKeyDown handler that runs `handler` on Enter or Space. Keys
 * pressed on nested controls (buttons inside a row) are ignored so they keep
 * their own behaviour.
 */
export function onActivateKey(handler) {
  return (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler(e);
    }
  };
}
