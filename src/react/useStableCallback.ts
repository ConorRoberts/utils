// oxlint-disable no-explicit-any

import { useCallback, useRef } from "react";

type AnyFunction = (...args: any[]) => any;
type AnyArgs = any[];

/**
 * Creates a stable callback that always calls the latest version of the function.
 * Useful for callbacks that need to be used in dependency arrays but should always
 * execute the most recent version of the callback.
 */
export const useStableCallback = <T extends AnyFunction>(callback: T): T => {
  const callbackRef = useRef(callback);

  // Update the ref on every render
  callbackRef.current = callback;

  return useCallback((...args: AnyArgs) => {
    return callbackRef.current(...args);
  }, []) as T;
};
