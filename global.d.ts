// Fix: Add webkitAudioContext to the Window interface to fix TypeScript errors.
// This is for compatibility with older Safari browsers.
interface Window {
  webkitAudioContext: typeof AudioContext;
}
