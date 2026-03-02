import React, { useState, useMemo } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Category definitions ──────────────────────────────────────────────────────
export const CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: 'kitchen',     label: 'Kitchen',     emoji: '🍳' },
  { value: 'bedroom',     label: 'Bedroom',     emoji: '🛏️' },
  { value: 'bathroom',    label: 'Bathroom',    emoji: '🚿' },
  { value: 'living_room', label: 'Living Room', emoji: '🛋️' },
  { value: 'dog',         label: 'Dog',         emoji: '🐕' },
  { value: 'other',       label: 'Other',       emoji: '📦' },
];

const EMOJI_OPTIONS = ['🏠', '🐕', '🍖', '🧹', '🪣', '🛒', '🚽', '👕', '🗑️', '🍳', '🧽', '🪴', '🚿', '🧺', '🍽️', '🛏️', '💊', '📬', '🧴', '🪥', '🫧', '🧹', '🪟', '🌿'];
const COLOR_OPTIONS = ['#0D9488', '#F97066', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6', '#6B7280', '#10B981'];

interface TaskFormData {
  name: string;
  icon: string;
  category: string;
  frequency: string;
  frequency_value: number;
  max_per_cycle: number;
  points: number;
  assigned_to: string;
  color_tag: string;
}

const defaultForm: TaskFormData = {
  name: '', icon: '🏠', category: 'other', frequency: 'daily',
  frequency_value: 1, max_per_cycle: 1, points: 5, assigned_to: 'both', color_tag: '#0D9488',
};

const TasksPage: React.FC = () => {
  const { tasks, householdId, members, currentMember, refreshData } = useHousehold();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaskFormData>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.name.trim() || !householdId) return;

    if (editingId) {
      await supabase.from('tasks').update({
        name: form.name,
        icon: form.icon,
        category: form.category,
        frequency: form.frequency,
        frequency_value: form.frequency_value,
        max_per_cycle: form.max_per_cycle,
        points: form.points,
        assigned_to: form.assigned_to,
        color_tag: form.color_tag,
      }).eq('id', editingId);
    } else {
      await supabase.from('tasks').insert({
        ...form,
        household_id: householdId,
        created_by: currentMember?.id,
      });
    }

    setOpen(false);
    setForm(defaultForm);
    setEditingId(null);
    refreshData();
  };

  const handleEdit = (task: any) => {
    setForm({
      name: task.name,
      icon: task.icon,
      category: task.category ?? 'other',
      frequency: task.frequency,
      frequency_value: task.frequency_value || 1,
      max_per_cycle: task.max_per_cycle,
      points: task.points,
      assigned_to: task.assigned_to,
      color_tag: task.color_tag,
    });
    setEditingId(task.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    refreshData();
  };

  // Group tasks by category, preserving CATEGORIES order
  const grouped = useMemo(() => {
    return CATEGORIES
      .map(cat => ({
        ...cat,
        tasks: tasks.filter(t => (t.category ?? 'other') === cat.value),
      }))
      .filter(g => g.tasks.length > 0);
  }, [tasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-foreground">Tasks</h1>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(defaultForm); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Task' : 'New Task'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Task name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="rounded-xl"
              />

              {/* Category picker */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-2">Area</p>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setForm({ ...form, category: cat.value })}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-semibold transition-colors ${
                        form.category === cat.value
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-xl">{cat.emoji}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji picker */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-2">Icon</p>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => setForm({ ...form, icon: e })}
                      className={`text-2xl p-1.5 rounded-lg ${form.icon === e ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-2">Color Tag</p>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color_tag: c })}
                      className={`w-8 h-8 rounded-full ${form.color_tag === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Points</p>
                  <Input type="number" min={1} value={form.points} onChange={e => setForm({ ...form, points: parseInt(e.target.value) || 1 })} className="rounded-xl" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Max / Day</p>
                  <Input type="number" min={1} value={form.max_per_cycle} onChange={e => setForm({ ...form, max_per_cycle: parseInt(e.target.value) || 1 })} className="rounded-xl" />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Frequency</p>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Assigned to</p>
                <Select value={form.assigned_to} onValueChange={v => setForm({ ...form, assigned_to: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSave} className="w-full rounded-xl h-12 font-bold">
                {editingId ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grouped task list */}
      {grouped.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No tasks yet. Tap "Add Task" to get started!</p>
      )}

      {grouped.map((group, gi) => (
        <motion.div
          key={group.value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.04 }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{group.emoji}</span>
            <h2 className="font-bold text-foreground">{group.label}</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{group.tasks.length}</span>
          </div>

          <div className="space-y-2">
            {group.tasks.map((task, i) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.04 + i * 0.03 }}
                className="bg-card rounded-2xl border p-4 flex items-center gap-3"
              >
                <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: task.color_tag }} />
                <div className="text-2xl">{task.icon}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground truncate">{task.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {task.points} pts · {task.frequency} · max {task.max_per_cycle}/day
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(task)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="p-2 rounded-xl hover:bg-destructive/10 text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default TasksPage;
