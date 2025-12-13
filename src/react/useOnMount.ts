import { useEffect } from "react";
import { useStableCallback } from "./useStableCallback";

/**
 * Calls the given callback when the component mounts.
 * Uses useStableCallback internally to ensure the latest version is called.
 *
 * @param callback - The function to run when the component mounts.
 *
 * @example
 * ```tsx
 * useOnMount(() => {
 *   console.log("Component mounted!");
 * });
 * ```
 */
export const useOnMount = (callback: () => void): void => {
  const stableCallback = useStableCallback(callback);

  useEffect(() => {
    stableCallback();
  }, [stableCallback]);
};
