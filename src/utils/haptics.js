/**
 * Trigger haptic feedback on supported devices.
 * @param {"light" | "medium" | "heavy" | "success" | "error" | "selection" | "tap"} type - Intensity / pattern of the haptic
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [35],
      success: [12, 60, 18],
      error: [30, 40, 30, 40, 30],
      selection: [8],
      tap: [6],
    };
    const pattern = patterns[type] ?? patterns.light;
    navigator.vibrate(pattern);
  }
}
