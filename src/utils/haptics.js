/**
 * Trigger haptic feedback on supported devices.
 * @param {"light" | "medium" | "heavy"} type - Intensity of the haptic
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const durations = { light: 10, medium: 20, heavy: 35 };
    const ms = durations[type] ?? durations.light;
    navigator.vibrate(ms);
  }
}
