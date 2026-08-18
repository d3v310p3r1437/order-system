import { useEffect, useState } from "react";

// docs/plan.md §8 Phase 2 Хэсэг B, даалгавар #11: хайлтын талбарт
// debounce хэрэгтэй (товшилт бүрт GET /catalog/search дуудахгүй байх).
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
