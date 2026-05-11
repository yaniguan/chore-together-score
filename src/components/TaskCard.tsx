import React, { useMemo, useRef, useState } from 'react';
import { useHousehold, Task } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Check, Star, Minus, Camera, Image as ImageIcon } from 'lucide-react';
import { getTaskCompletionsForDate } from '@/lib/completions';
import { toast } from 'sonner';
import { haptic, playClick } from '@/lib/feedback';

const TaskCard: React.FC<{ task: Task; onComplete?: () => void; compact?: boolean }> = ({ task, onComplete, compact }) => {
  const { currentMember, completions, householdId, members, uploadProofPhoto, mutateCompletions } = useHousehold();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const todayMyCompletions = useMemo(() =>
    getTaskCompletionsForDate(completions, task.id, new Date(), currentMember?.id),
    [completions, task.id, currentMember?.id]
  );

  const todayAllCompletions = useMemo(() =>
    getTaskCompletionsForDate(completions, task.id, new Date()),
    [completions, task.id]
  );

  // Pre-compute per-member counts in a single pass
  const memberCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of todayAllCompletions) {
      map[c.member_id] = (map[c.member_id] ?? 0) + 1;
    }
    return map;
  }, [todayAllCompletions]);

  const canComplete = todayMyCompletions.length < task.max_per_cycle;
  const canUndo = todayMyCompletions.length > 0;

  const handleComplete = async () => {
    if (!canComplete || !currentMember || !householdId) return;

    haptic();
    playClick();
    confetti({
      particleCount: 30,
      spread: 60,
      origin: { y: 0.7 },
      colors: [currentMember.avatar_color, '#FFD700', '#FFA500'],
    });

    // Optimistic insert: temp id, instantly visible. Realtime will replace
    // with the real row; on error we splice it back out.
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic = {
      id: tempId,
      task_id: task.id,
      household_id: householdId,
      member_id: currentMember.id,
      points_earned: task.points,
      completed_at: new Date().toISOString(),
      photo_url: null,
    };
    mutateCompletions(prev => [optimistic, ...prev]);

    const { error } = await supabase.from('completions').insert({
      task_id: task.id,
      household_id: householdId,
      member_id: currentMember.id,
      points_earned: task.points,
    });
    if (error) {
      mutateCompletions(prev => prev.filter(c => c.id !== tempId));
      toast.error(`完成失败: ${error.message}`);
      return;
    }
    onComplete?.();
  };

  const handleUndo = async () => {
    if (!canUndo || !currentMember) return;
    const latest = todayMyCompletions.reduce((a, b) =>
      a.completed_at > b.completed_at ? a : b
    );
    // Optimistic delete
    mutateCompletions(prev => prev.filter(c => c.id !== latest.id));
    const { error } = await supabase.from('completions').delete().eq('id', latest.id);
    if (error) {
      mutateCompletions(prev => [latest, ...prev]);
      toast.error(`撤销失败: ${error.message}`);
      return;
    }
    onComplete?.();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canComplete || !currentMember || !householdId) return;
    setUploading(true);
    try {
      const url = await uploadProofPhoto(file);
      if (!url) {
        toast.error('照片上传失败：检查 Supabase 是否已建好 task-proofs 桶（见迁移 SQL）', { duration: 6000 });
        return;
      }
      // Optimistic insert with the just-uploaded photo URL
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic = {
        id: tempId,
        task_id: task.id,
        household_id: householdId,
        member_id: currentMember.id,
        points_earned: task.points,
        completed_at: new Date().toISOString(),
        photo_url: url,
      };
      mutateCompletions(prev => [optimistic, ...prev]);

      const { error } = await supabase.from('completions').insert({
        task_id: task.id,
        household_id: householdId,
        member_id: currentMember.id,
        points_earned: task.points,
        photo_url: url,
      });
      if (error) {
        mutateCompletions(prev => prev.filter(c => c.id !== tempId));
        if (error.message?.includes('photo_url')) {
          toast.error('completions 表还没加 photo_url 列，请先跑迁移 SQL', { duration: 6000 });
        } else {
          toast.error(`记录失败: ${error.message}`);
        }
        return;
      }
      haptic();
      playClick();
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.7 },
        colors: [currentMember.avatar_color, '#FFD700', '#FFA500'],
      });
      onComplete?.();
    } finally {
      setUploading(false);
    }
  };

  // Most recent photo by anyone today (used for the camera/photo button state).
  const latestTodayPhoto = useMemo(() => {
    const withPhoto = todayAllCompletions.filter(c => c.photo_url);
    if (withPhoto.length === 0) return null;
    return withPhoto.reduce((a, b) => (a.completed_at > b.completed_at ? a : b)).photo_url;
  }, [todayAllCompletions]);

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-xl border p-2 flex flex-col gap-1 shadow-sm h-full"
      >
        <div className="text-2xl text-center leading-none mt-1">{task.icon}</div>
        <p className="text-[10px] font-bold text-foreground text-center line-clamp-2 leading-tight min-h-[28px]">{task.name}</p>
        <div className="flex items-center justify-center gap-0.5">
          <Star className="w-2.5 h-2.5 text-amber-500" />
          <span className="text-[9px] font-semibold text-amber-600">{task.points}pts</span>
          <span className="text-[9px] text-muted-foreground ml-1">{todayAllCompletions.length}/{task.max_per_cycle}</span>
        </div>
        {todayAllCompletions.length > 0 && (
          <div className="flex justify-center flex-wrap gap-0.5">
            {members.map(m => {
              const count = memberCounts[m.id];
              if (!count) return null;
              return (
                <span key={m.id} className="text-[8px] font-semibold px-1 rounded-full text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                  {m.display_name.split(' ')[0].charAt(0)}×{count}
                </span>
              );
            })}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />
        <div className="flex gap-1 mt-auto pt-1">
          {canUndo && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleUndo}
              className="w-7 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0"
              title="Undo"
            >
              <Minus className="w-3 h-3" />
            </motion.button>
          )}
          {latestTodayPhoto && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setPreviewUrl(latestTodayPhoto)}
              className="w-7 h-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
              title="查看照片"
            >
              <ImageIcon className="w-3 h-3" />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canComplete || uploading}
            className="w-7 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-40"
            title="拍照打卡"
          >
            <Camera className="w-3 h-3" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleComplete}
            disabled={!canComplete}
            className={`flex-1 h-8 rounded-lg flex items-center justify-center font-bold transition-all ${
              canComplete
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Check className="w-4 h-4" />
          </motion.button>
        </div>
        {previewUrl && <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />}
      </motion.div>
    );
  }

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
          {/* Who did it today — rendered from pre-computed map */}
          {todayAllCompletions.length > 0 && (
            <div className="flex gap-1 mt-1.5">
              {members.map(m => {
                const count = memberCounts[m.id];
                if (!count) return null;
                return (
                  <span key={m.id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-primary-foreground" style={{ backgroundColor: m.avatar_color }}>
                    {m.display_name.split(' ')[0]} ×{count}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelected}
        />

        {/* Photo button (camera or thumbnail) */}
        {latestTodayPhoto ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setPreviewUrl(latestTodayPhoto)}
            className="w-10 h-10 rounded-xl overflow-hidden border-2 border-primary/30 flex-shrink-0 hover:border-primary transition-colors"
            title="查看照片"
          >
            <img src={latestTodayPhoto} alt="proof" className="w-full h-full object-cover" />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canComplete || uploading}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-40"
            title="拍照打卡"
          >
            <Camera className="w-4 h-4" />
          </motion.button>
        )}

        {/* Undo button */}
        {canUndo && (
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleUndo}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0"
            title="Undo last completion"
          >
            <Minus className="w-4 h-4" />
          </motion.button>
        )}

        {/* Complete button */}
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
      {previewUrl && <PhotoLightbox url={previewUrl} onClose={() => setPreviewUrl(null)} />}
    </motion.div>
  );
};

export const PhotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] bg-black/90 backdrop-blur flex items-center justify-center p-4"
    onClick={onClose}
  >
    <motion.img
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      src={url}
      alt="proof"
      className="max-w-full max-h-full rounded-2xl object-contain"
      onClick={e => e.stopPropagation()}
    />
    <button
      onClick={onClose}
      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center"
      aria-label="关闭"
    >
      ✕
    </button>
  </motion.div>
);

export default TaskCard;
