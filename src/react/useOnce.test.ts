import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnce } from "./useOnce";

interface User {
  name: string;
}

describe("useOnce", () => {
  it("should run callback only once when condition is truthy", () => {
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => {
        useOnce(condition, callback);
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

    renderHook(() => useOnce(true, callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should accept non-boolean truthy values", () => {
    const callback = vi.fn();
    const user: User | null = { name: "John" };

    renderHook(() => useOnce(user, callback));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should work with user value in callback scope", () => {
    const user: User | null = { name: "Alice" };
    const results: string[] = [];

    renderHook(() =>
      useOnce(user, () => {
        if (!user) {
          return;
        }

        results.push(user.name);
      }),
    );

    expect(results).toEqual(["Alice"]);
  });

  it("should not run callback for falsy values", () => {
    const callback = vi.fn();

    renderHook(() => useOnce(null, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useOnce(undefined, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useOnce(false, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useOnce(0, callback));
    expect(callback).not.toHaveBeenCalled();

    renderHook(() => useOnce("", callback));
    expect(callback).not.toHaveBeenCalled();
  });
});
