import React, { useMemo } from 'react';
import { useHousehold, Task, Completion } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check, Star } from 'lucide-react';
import { useState } from 'react';

const getTodayCompletions = (completions: Completion[], taskId: string, memberId?: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return completions.filter(c =>
    c.task_id === taskId &&
    new Date(c.completed_at) >= today &&
    (!memberId || c.member_id === memberId)
  );
};

const TaskCard: React.FC<{ task: Task; onComplete?: () => void }> = ({ task, onComplete }) => {
  const { currentMember, completions, householdId, members } = useHousehold();

  const todayMyCompletions = useMemo(() =>
    getTodayCompletions(completions, task.id, currentMember?.id),
    [completions, task.id, currentMember?.id]
  );

  const todayAllCompletions = useMemo(() =>
    getTodayCompletions(completions, task.id),
    [completions, task.id]
  );

  const canComplete = todayMyCompletions.length < task.max_per_cycle;

  const handleComplete = async () => {
    if (!canComplete || !currentMember || !householdId) return;

    // Fire confetti
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 },
      colors: [currentMember.avatar_color, '#FFD700', '#FFA500'],
    });

    await supabase.from('completions').insert({
      task_id: task.id,
      household_id: householdId,
      member_id: currentMember.id,
      points_earned: task.points,
    });

    // Immediately refresh data
    onComplete?.();
  };

  const otherMember = members.find(m => m.id !== currentMember?.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl flex-shrink-0">{task.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground truncate">{task.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600">{task.points} pts</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">
              {todayAllCompletions.length}/{task.max_per_cycle} today
            </span>
          </div>
          {/* Who did it today */}
          {todayAllCompletions.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {members.map(m => {
                const count = getTodayCompletions(completions, task.id, m.id).length;
                if (count === 0) return null;
                return (
                  <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                    {m.display_name.split(' ')[0]} ×{count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleComplete}
          disabled={!canComplete}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg transition-all flex-shrink-0 ${
            canComplete
              ? 'bg-primary text-primary-foreground shadow-lg hover:shadow-xl active:shadow-md'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {canComplete ? <Check className="w-6 h-6" /> : '✓'}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default TaskCard;
