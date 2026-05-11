import React from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BarChart3, ListTodo, Settings, Gift, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', icon: Home, label: 'Today' },
  { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
  { path: '/tasks', icon: ListTodo, label: 'Tasks' },
  { path: '/shopping', icon: ShoppingCart, label: 'Shop' },
  { path: '/rewards', icon: Gift, label: 'Rewards' },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentMember, members } = useHousehold();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-lg text-foreground">HomePace</span>
          </div>
          <div className="flex items-center gap-2">
            {members.map(m => (
              <div
                key={m.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground ${m.id === currentMember?.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-60'}`}
                style={{ backgroundColor: m.avatar_color }}
                title={m.display_name}
              >
                {m.display_name.charAt(0).toUpperCase()}
              </div>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `ml-1 w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`
              }
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-lg border-t">
        <div className="max-w-lg mx-auto flex justify-around py-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-1 py-1 px-3 relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-0.5 w-8 h-1 rounded-full bg-primary"
                  />
                )}
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
