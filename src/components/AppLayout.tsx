import React from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { NavLink, useLocation } from 'react-router-dom';
import { CalendarCheck, CalendarRange, ShoppingCart, Gift, Settings, WifiOff, RefreshCw } from 'lucide-react';

const navItems = [
  { path: '/',          icon: CalendarCheck, label: '今天' },
  { path: '/month',     icon: CalendarRange, label: '本月' },
  { path: '/shopping',  icon: ShoppingCart,  label: '购物' },
  { path: '/rewards',   icon: Gift,          label: '奖励' },
];

const ConnectionBanner: React.FC = () => {
  const { loadError, refreshData } = useHousehold();
  const [retrying, setRetrying] = React.useState(false);
  if (!loadError) return null;

  const retry = async () => {
    setRetrying(true);
    try { await refreshData(); } finally { setRetrying(false); }
  };

  return (
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2">
      <div className="max-w-lg mx-auto flex items-center gap-2">
        <WifiOff className="w-4 h-4 text-destructive flex-shrink-0" />
        <p className="text-xs text-destructive flex-1 min-w-0">
          连不上数据库，显示的可能不是最新数据
        </p>
        <button
          onClick={retry}
          disabled={retrying}
          className="text-xs font-semibold text-destructive flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          重试
        </button>
      </div>
    </div>
  );
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentMember, members } = useHousehold();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <span className="font-bold text-[15px] tracking-tight">家务</span>

          <div className="flex items-center gap-1.5">
            {members.map(m => (
              <div
                key={m.id}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white transition-opacity ${
                  m.id === currentMember?.id ? '' : 'opacity-35'
                }`}
                style={{ backgroundColor: m.avatar_color }}
                title={m.display_name}
              >
                {m.display_name.charAt(0).toUpperCase()}
              </div>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `ml-1 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                }`
              }
              title="设置"
            >
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </NavLink>
          </div>
        </div>
        <ConnectionBanner />
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t">
        <div className="max-w-lg mx-auto flex justify-around py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-lg"
              >
                <item.icon
                  className={`w-[19px] h-[19px] ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span className={`text-[10px] ${isActive ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
