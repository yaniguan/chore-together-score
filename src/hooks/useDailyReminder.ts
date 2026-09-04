import { useEffect, useRef } from 'react';

const REMINDER_HOUR = 21;

/**
 * Fires a local notification at 9 PM if daily tasks remain. Only works while a
 * tab is open — a background timer is the ceiling without a push subscription —
 * but it now always schedules the *next* 9 PM rather than giving up for good
 * when the app is opened after the hour has passed.
 */
export const useDailyReminder = (
  enabled: boolean,
  getRemainingCount: () => number,
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref so the timer always reads the latest count at fire time,
  // without needing getRemainingCount in the scheduling effect's deps.
  const getRemainingCountRef = useRef(getRemainingCount);
  useEffect(() => {
    getRemainingCountRef.current = getRemainingCount;
  });

  useEffect(() => {
    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    let cancelled = false;

    const schedule = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(REMINDER_HOUR, 0, 0, 0);
      // Past today's slot — aim at tomorrow instead of never firing again.
      if (now >= target) target.setDate(target.getDate() + 1);

      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const remaining = getRemainingCountRef.current();
        if (remaining > 0) {
          new Notification('家务', {
            body: `还有 ${remaining} 个每天任务没做，今天加把劲`,
            icon: '/icon-192.png',
          });
        }
        schedule(); // roll over to the next day
      }, target.getTime() - now.getTime());
    };

    schedule();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled]);
};
