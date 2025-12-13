import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnMount } from "./useOnMount";

describe("useOnMount", () => {
  it("should run callback once when component mounts", () => {
    const callback = vi.fn();

    renderHook(() => useOnMount(callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should not run callback again on rerender", () => {
    const callback = vi.fn();

    const { rerender } = renderHook(() => useOnMount(callback));

    expect(callback).toHaveBeenCalledTimes(1);

    rerender();
    expect(callback).toHaveBeenCalledTimes(1);

    rerender();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should use the latest callback version", () => {
    const results: number[] = [];
    let value = 1;

    const { rerender } = renderHook(() =>
      useOnMount(() => {
        results.push(value);
      }),
    );

    expect(results).toEqual([1]);

    value = 2;
    rerender();

    // Should still only be called once (on mount)
    expect(results).toEqual([1]);
  });

  it("should run callback in useEffect (not synchronously)", () => {
    const executionOrder: string[] = [];

    renderHook(() => {
      executionOrder.push("before");
      useOnMount(() => {
        executionOrder.push("callback");
      });
      executionOrder.push("after");
    });

    // The callback should run in useEffect, so order should be: before, after, callback
    expect(executionOrder).toEqual(["before", "after", "callback"]);
  });

  it("should work with multiple instances independently", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() => {
      useOnMount(callback1);
      useOnMount(callback2);
    });

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it("should handle callback with side effects", () => {
    const sideEffects: string[] = [];

    renderHook(() =>
      useOnMount(() => {
        sideEffects.push("mounted");
        sideEffects.push("initialized");
      }),
    );

    expect(sideEffects).toEqual(["mounted", "initialized"]);
  });
});
