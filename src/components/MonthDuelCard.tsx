import React from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { daysLeftInMonth } from '@/lib/monthCycle';
import { UtensilsCrossed } from 'lucide-react';

/**
 * The whole point of the app in one card: who is ahead this month, by how
 * much, and how long the loser has left to catch up before buying dinner.
 */
const MonthDuelCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { members, monthEarned } = useHousehold();
  const daysLeft = daysLeftInMonth();

  if (members.length < 2) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground text-center">
        等另一个人加入后开始本月对决
      </div>
    );
  }

  const scored = members.map(m => ({ ...m, pts: monthEarned[m.id] ?? 0 }));
  const [a, b] = [...scored].sort((x, y) => y.pts - x.pts);
  const gap = a.pts - b.pts;
  const tied = gap === 0;
  const total = a.pts + b.pts;
  const aShare = total > 0 ? (a.pts / total) * 100 : 50;

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground">本月对决</p>
          <p className="text-xs text-muted-foreground">
            还剩 <span className="font-semibold text-foreground">{daysLeft}</span> 天
          </p>
        </div>

        {/* Scores */}
        <div className="flex items-end justify-between gap-3">
          {scored.map(m => (
            <div key={m.id} className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.avatar_color }} />
                <span className="text-xs text-muted-foreground truncate">{m.display_name.split(' ')[0]}</span>
              </div>
              <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: m.avatar_color }}>
                {m.pts}
              </p>
            </div>
          ))}
        </div>

        {/* Share bar */}
        <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-muted">
          <div style={{ width: `${aShare}%`, backgroundColor: a.avatar_color }} />
          <div style={{ width: `${100 - aShare}%`, backgroundColor: b.avatar_color }} />
        </div>
      </div>

      {/* Stakes */}
      <div className="bg-muted/50 border-t px-4 py-2.5 flex items-center gap-2">
        <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
        <p className="text-xs text-muted-foreground">
          {tied ? (
            <>目前<span className="font-semibold text-foreground">平手</span> · 月底输的请吃饭</>
          ) : (
            <>
              <span className="font-semibold" style={{ color: a.avatar_color }}>{a.display_name.split(' ')[0]}</span>
              {' '}领先 <span className="font-semibold text-foreground">{gap}</span> 分 ·{' '}
              {daysLeft > 0
                ? <><span className="font-semibold" style={{ color: b.avatar_color }}>{b.display_name.split(' ')[0]}</span> 再不追就要请客了</>
                : <><span className="font-semibold" style={{ color: b.avatar_color }}>{b.display_name.split(' ')[0]}</span> 请客</>}
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default MonthDuelCard;
