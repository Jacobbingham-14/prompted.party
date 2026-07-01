import { useEffect, useState } from 'react';

/**
 * Returns the seconds remaining until a shared server-supplied deadline.
 *
 * All devices in a room read the same deadline_at from the round row, so
 * countdowns stay in sync regardless of when each device joined the phase
 * or how much its local clock drifts.
 *
 * If deadlineIso is null/undefined, returns `fallbackSeconds` (used before
 * the host has written a deadline for the current phase).
 */
export function useSharedDeadline(
  deadlineIso: string | null | undefined,
  fallbackSeconds = 30
): { timeLeft: number; expired: boolean } {
  const computeRemaining = () => {
    if (!deadlineIso) return fallbackSeconds;
    const ms = new Date(deadlineIso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  };

  const [timeLeft, setTimeLeft] = useState<number>(computeRemaining);

  useEffect(() => {
    setTimeLeft(computeRemaining());
    const id = window.setInterval(() => setTimeLeft(computeRemaining()), 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineIso]);

  return { timeLeft, expired: timeLeft <= 0 };
}
