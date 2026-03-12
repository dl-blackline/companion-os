import { useState, useCallback } from 'react';

/**
 * A drop-in replacement for Spark's useKV hook.
 * Provides [value, setValue] with localStorage persistence.
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue =
          typeof value === 'function'
            ? (value as (prev: T) => T)(prev)
            : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (err) {
          console.error(`Error saving to localStorage key "${key}":`, err);
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
