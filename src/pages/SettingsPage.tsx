import React from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { Button } from '@/components/ui/button';
import { LogOut, Users, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const SettingsPage: React.FC = () => {
  const { currentMember, members, householdId, logout } = useHousehold();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Settings</h1>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-5 space-y-4">
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
