/**
 * Trigger haptic feedback on supported devices.
 * @param {"light" | "medium" | "heavy"} type - Intensity of the haptic
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    if (type === 'light') navigator.vibrate(10);
    if (type === 'medium') navigator.vibrate(20);
    if (type === 'heavy') navigator.vibrate(35);
  }
}
