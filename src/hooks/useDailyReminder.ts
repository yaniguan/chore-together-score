import { useEffect, useRef } from 'react';

export const useDailyReminder = (
  enabled: boolean,
  getRemainingCount: () => number,
) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const target = new Date();
    target.setHours(21, 0, 0, 0);

    // Already past 9pm today — skip until tomorrow (don't schedule)
    if (now >= target) return;

    const msUntil = target.getTime() - now.getTime();

    timerRef.current = setTimeout(() => {
      const remaining = getRemainingCount();
      if (remaining > 0) {
        new Notification('HomePace', {
          body: `还有 ${remaining} 个任务未完成，今天加把劲！`,
          icon: '/pwa-192x192.png',
        });
      }
    }, msUntil);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);
};
