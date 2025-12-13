import { useEffect, useRef } from "react";
import { useStableCallback } from "./useStableCallback";

/**
 * Runs a callback only once when a condition becomes truthy.
 * The callback is stabilized internally to always reference the latest version.
 *
 * @param condition - When truthy (evaluated via Boolean()), the callback will be executed (only once).
 * @param callback - The function to run once when the condition is met.
 *
 * @example
 * ```tsx
 * const isReady = true;
 * useOnce(isReady, () => {
 *   console.log("Ready!");
 * });
 * ```
 */
export const useOnce = (condition: unknown, callback: () => void): void => {
  const hasRunRef = useRef(false);
  const stableCallback = useStableCallback(callback);

  useEffect(() => {
    if (Boolean(condition) && !hasRunRef.current) {
      hasRunRef.current = true;
      stableCallback();
    }
  }, [condition, stableCallback]);
};
