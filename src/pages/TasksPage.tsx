import React, { useState, useMemo } from 'react';
import { Task, useHousehold } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, RotateCcw, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  CATEGORIES, CategoryValue, FREQUENCIES, FrequencyValue,
  normalizeCategory, normalizeFrequency, frequencyLabel,
} from '@/lib/constants';
import { CATEGORY_COLORS } from '@/lib/seedTasks';
import { ICON_GROUPS, TaskIcon } from '@/lib/taskIcons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskFormData {
  name: string;
  icon: string;
  category: CategoryValue;
  frequency: FrequencyValue;
  points: number;
}

const defaultForm: TaskFormData = {
  name: '', icon: 'sparkles', category: 'cleaning', frequency: 'daily', points: 3,
};

const TasksPage: React.FC = () => {
  const { tasks, householdId, currentMember, refreshData, resetTasksToDefaults, loadError } = useHousehold();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TaskFormData>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || !householdId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      icon: form.icon,
      category: form.category,
      frequency: form.frequency,
      frequency_value: 1,
      points: form.points,
      color_tag: CATEGORY_COLORS[form.category],
    };

    const { error } = editingId
      ? await supabase.from('tasks').update(payload).eq('id', editingId)
      : await supabase.from('tasks').insert({
          ...payload,
          household_id: householdId,
          assigned_to: 'both',
          created_by: currentMember?.id ?? null,
        });
    setSaving(false);

    if (error) {
      toast.error(`保存失败: ${error.message}`);
      return;
    }
    setOpen(false);
    setForm(defaultForm);
    setEditingId(null);
    refreshData();
  };

  const handleEdit = (task: Task) => {
    setForm({
      name: task.name,
      icon: task.icon,
      category: normalizeCategory(task.category),
      frequency: normalizeFrequency(task.frequency),
      points: task.points,
    });
    setEditingId(task.id);
    setOpen(true);
  };

  // Deleting a task cascades to its completions, so this always goes through
  // a confirmation — it silently rewrites past months otherwise.
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('tasks').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(`删除失败: ${error.message}`);
      return;
    }
    setDeleteTarget(null);
    refreshData();
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetTasksToDefaults();
      toast.success('已载入默认清单');
      setResetOpen(false);
    } catch (e) {
      toast.error(`重置失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setResetting(false);
    }
  };

  const grouped = useMemo(() =>
    CATEGORIES
      .map(cat => ({ ...cat, tasks: tasks.filter(t => normalizeCategory(t.category) === cat.value) }))
      .filter(g => g.tasks.length > 0),
    [tasks],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/settings')}
          className="w-8 h-8 -ml-2 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
          aria-label="返回设置"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold tracking-tight flex-1">管理任务</h1>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setResetOpen(true)}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> 默认清单
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={() => { setForm(defaultForm); setEditingId(null); setOpen(true); }}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> 新建
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        共 {tasks.length} 个任务。完成次数不限，做几次记几次；频率只决定首页的分组和计数窗口（每天当天清零、每周周一清零、每月 1 号清零）。
      </p>

      {/* Task list */}
      {grouped.length === 0 && (
        <div className="text-center py-12 space-y-3">
          {/* Seeding while the database is unreachable would just fail again. */}
          {loadError ? (
            <p className="text-sm text-muted-foreground">任务没能加载出来，请检查网络后重试</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">还没有任务</p>
              <Button size="sm" onClick={() => setResetOpen(true)}>载入默认清单</Button>
            </>
          )}
        </div>
      )}

      {grouped.map(group => (
        <div key={group.value}>
          <div className="flex items-center gap-2 mb-1">
            <TaskIcon name={group.icon} className="w-3.5 h-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground">{group.label}</h2>
            <span className="text-[10px] text-muted-foreground">{group.tasks.length}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="divide-y">
            {group.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-2.5">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  <TaskIcon name={task.icon} className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {task.points} 分 · {frequencyLabel(task.frequency)}
                  </p>
                </div>
                <button
                  onClick={() => handleEdit(task)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                  aria-label={`编辑 ${task.name}`}
                >
                  <Pencil className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => setDeleteTarget(task)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`删除 ${task.name}`}
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(defaultForm); setEditingId(null); } }}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editingId ? '编辑任务' : '新建任务'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="任务名称"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              maxLength={20}
            />

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">区域</p>
              <div className="grid grid-cols-3 gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setForm({ ...form, category: cat.value })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs transition-colors ${
                      form.category === cat.value
                        ? 'border-foreground bg-muted font-semibold'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <TaskIcon name={cat.icon} className="w-3.5 h-3.5" />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">图标</p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {ICON_GROUPS.map(g => (
                  <div key={g.label}>
                    <p className="text-[10px] text-muted-foreground mb-1">{g.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {g.icons.map(name => (
                        <button
                          key={`${g.label}-${name}`}
                          onClick={() => setForm({ ...form, icon: name })}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            form.icon === name
                              ? 'bg-foreground text-background'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                          aria-label={name}
                        >
                          <TaskIcon name={name} className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">频率</p>
              <Select
                value={form.frequency}
                onValueChange={v => setForm({ ...form, frequency: v as FrequencyValue })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">每次得分</p>
              <Input
                type="number" min={1} max={50} value={form.points}
                onChange={e => setForm({ ...form, points: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="w-full font-semibold">
              {saving ? '保存中…' : editingId ? '保存修改' : '创建任务'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{deleteTarget?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              这个任务过去所有的完成记录会一起删除，本月和最近几个月的得分会随之变化。已归档的月份总分不受影响。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>载入默认清单?</AlertDialogTitle>
            <AlertDialogDescription>
              删除当前全部任务，换成为 1b1b 整理的 51 项默认清单（厨房 / 卫生间 / 打扫 / 洗衣 / 狗）。
              当前任务下的完成记录会一并删除，已归档的过往月份总分不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={resetting}>
              {resetting ? '载入中…' : '确认载入'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TasksPage;
