import React, { useState } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LogOut, Users, Home, Sun, Bell, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import {
  getHapticEnabled, getSoundEnabled,
  setHapticEnabled, setSoundEnabled,
  haptic, playClick,
} from '@/lib/feedback';

const SettingsPage: React.FC = () => {
  const { currentMember, members, householdId, logout } = useHousehold();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const { enabled: notificationsEnabled, toggle: toggleNotifications } = useNotifications();
  const [hapticOn, setHapticOn] = useState(() => getHapticEnabled());
  const [soundOn, setSoundOn] = useState(() => getSoundEnabled());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Settings</h1>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" />
          <h2 className="font-bold">Appearance</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Dark Mode</p>
            <p className="text-xs text-muted-foreground">Switch between light and dark theme</p>
          </div>
          <Switch
            checked={isDark}
            onCheckedChange={checked => setTheme(checked ? 'dark' : 'light')}
          />
        </div>
      </motion.div>

      {/* Feedback */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          <h2 className="font-bold">Feedback</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Vibration</p>
            <p className="text-xs text-muted-foreground">Short buzz when you complete a task</p>
          </div>
          <Switch
            checked={hapticOn}
            onCheckedChange={v => {
              setHapticEnabled(v);
              setHapticOn(v);
              if (v) haptic();
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Click Sound</p>
            <p className="text-xs text-muted-foreground">Tap-tone on completion</p>
          </div>
          <Switch
            checked={soundOn}
            onCheckedChange={v => {
              setSoundEnabled(v);
              setSoundOn(v);
              if (v) playClick();
            }}
          />
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="font-bold">Notifications</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Daily Reminder</p>
            <p className="text-xs text-muted-foreground">Remind at 9 PM if tasks remain</p>
          </div>
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={toggleNotifications}
          />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Home className="w-5 h-5 text-primary" />
          <h2 className="font-bold">Household</h2>
        </div>
        <p className="text-sm text-muted-foreground">Share the PIN with your partner to let them join on their device.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-bold">Members</h2>
        </div>
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                {m.display_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-foreground">{m.display_name}</p>
                {m.id === currentMember?.id && <p className="text-xs text-primary font-semibold">That's you!</p>}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Button variant="outline" onClick={logout} className="w-full rounded-xl h-12 font-bold text-destructive border-destructive/20 hover:bg-destructive/5">
          <LogOut className="w-4 h-4 mr-2" /> Switch User / Leave
        </Button>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
