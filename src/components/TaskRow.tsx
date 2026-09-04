import React, { useMemo, useRef, useState } from 'react';
import { useHousehold, Task } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import confetti from 'canvas-confetti';
import { Check, Undo2, Camera } from 'lucide-react';
import { getTaskCompletionsForCycle, cycleLabel } from '@/lib/completions';
import { TaskIcon } from '@/lib/taskIcons';
import { toast } from 'sonner';
import { haptic, playClick } from '@/lib/feedback';
import PhotoLightbox from '@/components/PhotoLightbox';

/**
 * One chore, one row. Tap the check to bank it; the counter on the left tracks
 * the task's own cycle (day / week / month), not always "today".
 */
const TaskRow: React.FC<{ task: Task }> = ({ task }) => {
  const { currentMember, completions, householdId, members, uploadProofPhoto, mutateCompletions } = useHousehold();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const cycleCompletions = useMemo(
    () => getTaskCompletionsForCycle(completions, task, new Date()),
    [completions, task],
  );

  const myCompletions = useMemo(
    () => cycleCompletions.filter(c => c.member_id === currentMember?.id),
    [cycleCompletions, currentMember?.id],
  );

  const memberCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cycleCompletions) map[c.member_id] = (map[c.member_id] ?? 0) + 1;
    return map;
  }, [cycleCompletions]);

  const done = cycleCompletions.length;
  const isFull = done >= task.max_per_cycle;
  const canComplete = !isFull;
  const canUndo = myCompletions.length > 0;

  const latestPhoto = useMemo(() => {
    const withPhoto = cycleCompletions.filter(c => c.photo_url);
    if (withPhoto.length === 0) return null;
    return withPhoto.reduce((a, b) => (a.completed_at > b.completed_at ? a : b)).photo_url;
  }, [cycleCompletions]);

  const celebrate = () => {
    haptic();
    playClick();
    confetti({
      particleCount: 24,
      spread: 55,
      origin: { y: 0.75 },
      colors: [currentMember?.avatar_color ?? '#0D9488', '#FFD700'],
      disableForReducedMotion: true,
    });
  };

  const insertCompletion = async (photoUrl: string | null) => {
    if (!currentMember || !householdId) return false;
    const tempId = `temp-${crypto.randomUUID()}`;
    mutateCompletions(prev => [{
      id: tempId,
      task_id: task.id,
      household_id: householdId,
      member_id: currentMember.id,
      points_earned: task.points,
      completed_at: new Date().toISOString(),
      photo_url: photoUrl,
    }, ...prev]);

    const { error } = await supabase.from('completions').insert({
      task_id: task.id,
      household_id: householdId,
      member_id: currentMember.id,
      points_earned: task.points,
      ...(photoUrl ? { photo_url: photoUrl } : {}),
    });
    if (error) {
      mutateCompletions(prev => prev.filter(c => c.id !== tempId));
      toast.error(`记录失败: ${error.message}`);
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!canComplete || !currentMember || !householdId) return;
    celebrate();
    await insertCompletion(null);
  };

  const handleUndo = async () => {
    if (!canUndo) return;
    const latest = myCompletions.reduce((a, b) => (a.completed_at > b.completed_at ? a : b));
    mutateCompletions(prev => prev.filter(c => c.id !== latest.id));
    haptic(15);
    const { error } = await supabase.from('completions').delete().eq('id', latest.id);
    if (error) {
      mutateCompletions(prev => [latest, ...prev]);
      toast.error(`撤销失败: ${error.message}`);
    }
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canComplete || !currentMember || !householdId) return;
    setUploading(true);
    try {
      const url = await uploadProofPhoto(file);
      if (!url) {
        toast.error('照片上传失败，请检查网络或 task-proofs 存储桶', { duration: 6000 });
        return;
      }
      const ok = await insertCompletion(url);
      if (ok) celebrate();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex items-center gap-3 py-2.5 transition-opacity ${isFull ? 'opacity-45' : ''}`}>
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
        <TaskIcon name={task.icon} className="w-[18px] h-[18px]" />
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isFull ? 'line-through' : ''}`}>{task.name}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
          <span>{task.points} 分</span>
          <span>·</span>
          <span>{cycleLabel(task.frequency)} {done}/{task.max_per_cycle}</span>
          {members.map(m => {
            const count = memberCounts[m.id];
            if (!count) return null;
            return (
              <span key={m.id} className="flex items-center gap-0.5 font-medium" style={{ color: m.avatar_color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.avatar_color }} />
                {count}
              </span>
            );
          })}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {latestPhoto ? (
          <button
            onClick={() => setPreviewUrl(latestPhoto)}
            className="w-8 h-8 rounded-lg overflow-hidden border"
            title="查看照片"
          >
            <img src={latestPhoto} alt="完成照片" className="w-full h-full object-cover" />
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canComplete || uploading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            title="拍照打卡"
          >
            <Camera className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-25 transition-colors"
          title="撤销"
        >
          <Undo2 className="w-4 h-4" strokeWidth={1.75} />
        </button>

        <button
          onClick={handleComplete}
          disabled={!canComplete}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
            canComplete
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground'
          }`}
          aria-label={`完成 ${task.name}`}
        >
          <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>
      </div>

      {previewUrl && <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </div>
  );
};

export default TaskRow;
