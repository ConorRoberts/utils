import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLocalOnce } from "./useLocalOnce";

interface User {
  name: string;
}

describe("useLocalOnce", () => {
  it("should run callback only once when condition is truthy", () => {
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => {
        useLocalOnce(condition, callback);
      },
      {
        initialProps: { condition: false },
      },
    );

    expect(callback).not.toHaveBeenCalled();

    // Change condition to true
    rerender({ condition: true });
    expect(callback).toHaveBeenCalledTimes(1);

    // Rerender with condition still true
    rerender({ condition: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should run callback immediately if condition starts as truthy", () => {
    const callback = vi.fn();

    renderHook(() => useLocalOnce(true, callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should accept non-boolean truthy values", () => {
    const callback = vi.fn();
    const user: User | null = { name: "John" };

    renderHook(() => useLocalOnce(user, callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should not run callback for falsy values", () => {
    const callback = vi.fn();

    renderHook(() => useLocalOnce(null, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useLocalOnce(undefined, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useLocalOnce(false, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useLocalOnce(0, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useLocalOnce("", callback));
    expect(callback).not.toHaveBeenCalled();
  });

  it("should run synchronously during render (not in useEffect)", () => {
    const executionOrder: string[] = [];

    renderHook(() => {
      executionOrder.push("before");
      useLocalOnce(true, () => {
        executionOrder.push("callback");
      });
      executionOrder.push("after");
    });

    // The callback should run synchronously, so order should be: before, callback, after
    expect(executionOrder).toEqual(["before", "callback", "after"]);
  });
});
