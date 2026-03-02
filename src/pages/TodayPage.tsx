import React, { useMemo } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import TaskCard from '@/components/TaskCard';
import { motion } from 'framer-motion';
import { useCallback } from 'react';

const TodayPage: React.FC = () => {
  const { tasks, completions, currentMember, members, refreshData } = useHousehold();

  const todayPoints = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return members.map(m => ({
      ...m,
      points: completions
        .filter(c => c.member_id === m.id && new Date(c.completed_at) >= today)
        .reduce((sum, c) => sum + c.points_earned, 0),
    }));
  }, [completions, members]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-foreground">
          {greeting()}, {currentMember?.display_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what needs doing today</p>
      </motion.div>

      {/* Today's score mini-board */}
      <div className="grid grid-cols-2 gap-3">
        {todayPoints.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 border"
            style={{ backgroundColor: `${m.avatar_color}15` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                {m.display_name.charAt(0)}
              </div>
              <span className="text-sm font-semibold text-foreground truncate">{m.display_name.split(' ')[0]}</span>
            </div>
            <p className="text-3xl font-extrabold" style={{ color: m.avatar_color }}>{m.points}</p>
            <p className="text-xs text-muted-foreground">points today</p>
          </motion.div>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Today's Tasks</h2>
        {tasks.map((task, i) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <TaskCard task={task} onComplete={refreshData} />
          </motion.div>
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No tasks yet. Add some in the Tasks tab!</p>
        )}
      </div>
    </div>
  );
};

export default TodayPage;
