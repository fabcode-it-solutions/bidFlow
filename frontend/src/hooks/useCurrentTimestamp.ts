import { useState, useEffect } from 'react';

/**
 * Returns a bigint timestamp (seconds) that updates every second.
 * Used by auction components to compute remaining time.
 */
export function useCurrentTimestamp(): bigint {
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
