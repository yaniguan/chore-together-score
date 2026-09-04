import React, { useEffect, useState } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  LogOut, ListTodo, ChevronRight, Moon, Bell, Vibrate, Volume2, Copy, Check, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { useNotifications } from '@/hooks/useNotifications';
import {
  getHapticEnabled, getSoundEnabled,
  setHapticEnabled, setSoundEnabled,
  haptic, playClick,
} from '@/lib/feedback';

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}> = ({ icon, title, desc, children }) => (
  <div className="flex items-center gap-3 py-3">
    <span className="text-muted-foreground flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{title}</p>
      {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
    </div>
    {children}
  </div>
);

const SettingsPage: React.FC = () => {
  const { currentMember, members, householdId, tasks, logout } = useHousehold();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { enabled: notificationsEnabled, toggle: toggleNotifications } = useNotifications();
  const [hapticOn, setHapticOn] = useState(() => getHapticEnabled());
  const [soundOn, setSoundOn] = useState(() => getSoundEnabled());

  // The PIN is the only way a partner joins on a new device, so it has to be
  // retrievable here — the card used to just say "share the PIN" and show none.
  const [pin, setPin] = useState<string | null>(null);
  const [pinVisible, setPinVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    supabase.from('households').select('pin').eq('id', householdId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('failed to load household pin', error);
        else setPin(data?.pin ?? null);
      });
  }, [householdId]);

  const copyPin = async () => {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动记下');
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold tracking-tight">设置</h1>

      {/* Household + PIN */}
      <div className="rounded-xl border p-4">
        <p className="text-xs font-semibold text-muted-foreground mb-3">家庭</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground mb-1">加入密码 · 伴侣换设备时需要</p>
            <p className="text-xl font-bold tabular-nums tracking-[0.2em]">
              {pin ? (pinVisible ? pin : '•'.repeat(pin.length)) : '——'}
            </p>
          </div>
          <button
            onClick={() => setPinVisible(v => !v)}
            disabled={!pin}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label={pinVisible ? '隐藏密码' : '显示密码'}
          >
            {pinVisible ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
          </button>
          <button
            onClick={copyPin}
            disabled={!pin}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
            aria-label="复制密码"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" strokeWidth={2} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </div>

        <div className="border-t pt-3 space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2.5">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.display_name.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm flex-1 truncate">{m.display_name}</span>
              {m.id === currentMember?.id && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">当前</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Task management */}
      <button
        onClick={() => navigate('/settings/tasks')}
        className="w-full rounded-xl border px-4 hover:bg-muted/50 transition-colors text-left"
      >
        <Row
          icon={<ListTodo className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          title="管理任务"
          desc={`${tasks.length} 个任务 · 增删改、载入默认清单`}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Row>
      </button>

      {/* Preferences */}
      <div className="rounded-xl border px-4 divide-y">
        <Row
          icon={<Moon className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          title="深色模式"
        >
          <Switch checked={theme === 'dark'} onCheckedChange={c => setTheme(c ? 'dark' : 'light')} />
        </Row>
        <Row
          icon={<Bell className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          title="每晚提醒"
          desc="晚上 9 点，如果还有每天任务没做"
        >
          <Switch checked={notificationsEnabled} onCheckedChange={toggleNotifications} />
        </Row>
        <Row
          icon={<Vibrate className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          title="震动反馈"
        >
          <Switch
            checked={hapticOn}
            onCheckedChange={v => { setHapticEnabled(v); setHapticOn(v); if (v) haptic(); }}
          />
        </Row>
        <Row
          icon={<Volume2 className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          title="完成音效"
        >
          <Switch
            checked={soundOn}
            onCheckedChange={v => { setSoundEnabled(v); setSoundOn(v); if (v) playClick(); }}
          />
        </Row>
      </div>

      <Button
        variant="outline"
        onClick={logout}
        className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
      >
        <LogOut className="w-4 h-4 mr-2" strokeWidth={1.75} /> 切换用户
      </Button>
    </div>
  );
};

export default SettingsPage;
