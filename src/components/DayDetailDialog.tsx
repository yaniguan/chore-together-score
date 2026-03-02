import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHousehold } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { Completion } from '@/context/HouseholdContext';
import { getDayBounds } from '@/lib/completions';

interface Props {
  date: Date | null;
  onClose: () => void;
}

const DayDetailDialog: React.FC<Props> = ({ date, onClose }) => {
  const { householdId, members, tasks, refreshData } = useHousehold();
  const [dayCompletions, setDayCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDayCompletions = useCallback(async () => {
    if (!date || !householdId) return;
    setLoading(true);
    const { start: startOfDay, end: endOfDay } = getDayBounds(date);

    const { data } = await supabase.from('completions').select('*')
      .eq('household_id', householdId)
      .gte('completed_at', startOfDay.toISOString())
      .lte('completed_at', endOfDay.toISOString());

    if (data) setDayCompletions(data as Completion[]);
    setLoading(false);
  }, [date, householdId]);

  useEffect(() => {
    fetchDayCompletions();
    setShowAddForm(false);
    setSelectedTaskId('');
    setSelectedMemberId('');
  }, [date, householdId, fetchDayCompletions]);

  const handleAddEntry = async () => {
    if (!selectedTaskId || !selectedMemberId || !date || !householdId) return;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    setSubmitting(true);
    // Use noon of selected date to avoid timezone issues
    const completedAt = new Date(date);
    completedAt.setHours(12, 0, 0, 0);

    await supabase.from('completions').insert({
      task_id: selectedTaskId,
      household_id: householdId,
      member_id: selectedMemberId,
      points_earned: task.points,
      completed_at: completedAt.toISOString(),
    });

    await Promise.all([fetchDayCompletions(), refreshData()]);
    setShowAddForm(false);
    setSelectedTaskId('');
    setSelectedMemberId('');
    setSubmitting(false);
  };

  if (!date) return null;

  const dateLabel = date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Dialog open={!!date} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{dateLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task completions grouped by task */}
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-2">Task Completions</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => {
                  const taskCompletions = dayCompletions.filter(c => c.task_id === task.id);
                  return (
                    <div key={task.id} className="rounded-lg border p-3">
                      <p className="font-medium text-sm">{task.icon} {task.name}</p>
                      {taskCompletions.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-1">No completions</p>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {members.map(m => {
                            const count = taskCompletions.filter(c => c.member_id === m.id).length;
                            if (count === 0) return null;
                            const pts = taskCompletions.filter(c => c.member_id === m.id).reduce((s, c) => s + c.points_earned, 0);
                            return (
                              <p key={m.id} className="text-xs" style={{ color: m.avatar_color }}>
                                {m.display_name} ×{count} (+{pts} pts)
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add entry form */}
          {!showAddForm ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAddForm(true)}>
              + Add Entry
            </Button>
          ) : (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-semibold">Add Completion</p>
              <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select task..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.icon} {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${selectedMemberId === m.id ? 'text-primary-foreground' : 'bg-muted text-foreground'}`}
                    style={selectedMemberId === m.id ? { backgroundColor: m.avatar_color, borderColor: m.avatar_color } : {}}
                  >
                    {m.display_name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={!selectedTaskId || !selectedMemberId || submitting}
                  onClick={handleAddEntry}
                >
                  {submitting ? 'Saving...' : 'Confirm'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DayDetailDialog;
