import { useState, useCallback } from 'react';

const STORAGE_KEY = 'homepace_notifications_enabled';

export const useNotifications = () => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const toggle = useCallback(async (value: boolean) => {
    if (value && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        localStorage.setItem(STORAGE_KEY, 'false');
        setEnabled(false);
        return;
      }
    }
    localStorage.setItem(STORAGE_KEY, String(value));
    setEnabled(value);
  }, []);

  return { enabled, toggle };
};
