import { useEffect, useRef } from 'preact/hooks';

// Mirrors the mobile-menu pattern in Header.astro: push a history marker when
// an overlay opens so the browser back button / iOS back-swipe pops the
// overlay closed instead of leaving the page.
//
// Design notes:
//   - The popstate listener is only attached while the overlay is open, so
//     dormant hook instances on closed overlays cannot interfere with other
//     popstate listeners on the page (e.g. the header menu's own pattern).
//   - When the overlay closes programmatically (Escape, X button, swipe-down),
//     we pop our marker via history.back() so the user isn't left with a
//     stale back-entry. We skip that if the close was triggered BY a back-
//     press, since the browser already popped for us.
export function useBackToClose(isOpen: boolean, close: () => void, stateKey: string): void {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isOpen) return;

    history.pushState({ [stateKey]: true }, '');

    let consumedByBack = false;
    const onPop = (e: PopStateEvent) => {
      // Only react if OUR marker was the one popped. If the new state still
      // has our key, the pop was for something stacked above us (e.g. the
      // header menu opened on top of an already-open station detail) — let
      // that overlay handle its own close and leave us alone.
      const state = e.state as Record<string, unknown> | null;
      if (state && state[stateKey]) return;
      consumedByBack = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (consumedByBack) return;
      if (history.state && (history.state as Record<string, unknown>)[stateKey]) {
        history.back();
      }
    };
  }, [isOpen, stateKey]);
}
