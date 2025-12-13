import { useRef } from "react";
import { useStableCallback } from "./useStableCallback";

/**
 * Runs a callback only once when a condition becomes truthy, executing synchronously
 * during render. The callback is stabilized internally to always reference the latest version.
 *
 * Unlike `useOnce`, this runs at the top level of the hook (not in useEffect),
 * making it suitable for state updates that need to happen synchronously during render.
 *
 * @param condition - When truthy (evaluated via Boolean()), the callback will be executed (only once).
 * @param callback - The function to run once when the condition is met.
 *
 * @example
 * ```tsx
 * const user: User | null = getUser();
 * useLocalOnce(user, () => {
 *   setState(user.name);
 * });
 * ```
 */
export const useLocalOnce = (condition: unknown, callback: () => void): void => {
  const hasRunRef = useRef(false);
  const stableCallback = useStableCallback(callback);

  if (Boolean(condition) && !hasRunRef.current) {
    hasRunRef.current = true;
    stableCallback();
  }
};
