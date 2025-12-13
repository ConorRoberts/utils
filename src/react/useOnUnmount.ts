import { useEffect } from "react";
import { useStableCallback } from "./useStableCallback";

/**
 * Calls the given callback when the component unmounts.
 * Uses useStableCallback internally to ensure the latest version is called.
 */
export const useOnUnmount = (callback: () => void): void => {
  const stableCallback = useStableCallback(callback);

  useEffect(() => {
    return () => {
      stableCallback();
    };
  }, [stableCallback]);
};
