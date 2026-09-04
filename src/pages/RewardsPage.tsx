import React, { useState, useMemo } from 'react';
import { useHousehold, Reward } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const RewardsPage: React.FC = () => {
  const {
    householdId, currentMember, members, rewards, redemptions,
    availablePoints, monthEarned, monthSpent, refreshData,
  } = useHousehold();

  const [redeemTarget, setRedeemTarget] = useState<Reward | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reward | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🎁');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myPoints = currentMember ? (availablePoints[currentMember.id] ?? 0) : 0;

  /**
   * Re-derives the balance at click time rather than trusting the disabled
   * state of the button — two devices redeeming at once used to be able to
   * drive the balance negative.
   */
  const handleRedeem = async () => {
    if (!redeemTarget || !currentMember || !householdId) return;
    setSubmitting(true);
    try {
      const earned = monthEarned[currentMember.id] ?? 0;
      const spent = monthSpent[currentMember.id] ?? 0;
      if (earned - spent < redeemTarget.points_cost) {
        toast.error(`积分不够，还差 ${redeemTarget.points_cost - (earned - spent)} 分`);
        setRedeemTarget(null);
        return;
      }

      const { error } = await supabase.from('redemptions').insert({
        household_id: householdId,
        member_id: currentMember.id,
        reward_id: redeemTarget.id,
        reward_name: redeemTarget.name,
        points_spent: redeemTarget.points_cost,
      });
      if (error) {
        toast.error(`兑换失败: ${error.message}`);
        return;
      }
      toast.success(`兑换成功：${redeemTarget.name}`);
      await refreshData();
      setRedeemTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async () => {
    const cost = parseInt(newCost, 10);
    if (!newName.trim() || isNaN(cost) || cost <= 0 || !householdId) return;
    setSubmitting(true);
    const { error } = await supabase.from('rewards').insert({
      household_id: householdId,
      name: newName.trim(),
      icon: newIcon.trim() || '🎁',
      points_cost: cost,
      category: newCategory.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(`添加失败: ${error.message}`);
      return;
    }
    await refreshData();
    setShowAdd(false);
    setNewName('');
    setNewIcon('🎁');
    setNewCost('');
    setNewCategory('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    const { error } = await supabase.from('rewards').delete().eq('id', deleteTarget.id);
    setSubmitting(false);
    if (error) {
      toast.error(`删除失败: ${error.message}`);
      return;
    }
    setDeleteTarget(null);
    await refreshData();
  };

  const groupedRewards = useMemo(() => {
    const groups: Record<string, Reward[]> = {};
    for (const r of rewards) {
      const key = r.category?.trim() || '未分类';
      (groups[key] ??= []).push(r);
    }
    return Object.entries(groups)
      .map(([label, items]) => ({ label, items: [...items].sort((a, b) => a.points_cost - b.points_cost) }))
      .sort((a, b) => (a.label === '未分类' ? 1 : b.label === '未分类' ? -1 : a.label.localeCompare(b.label)));
  }, [rewards]);

  const recentRedemptions = useMemo(() => redemptions.slice(0, 12), [redemptions]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">奖励</h1>
        <Button size="sm" className="text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> 新建
        </Button>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-2">
        {members.map(m => (
          <div key={m.id} className="rounded-xl border p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.avatar_color }} />
              <span className="text-xs text-muted-foreground truncate">{m.display_name.split(' ')[0]}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: m.avatar_color }}>
              {availablePoints[m.id] ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground">可用积分（本月）</p>
          </div>
        ))}
      </div>

      {/* Rewards */}
      {rewards.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Gift className="w-8 h-8 mx-auto text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">还没有奖励，加几个想要的吧</p>
        </div>
      ) : (
        groupedRewards.map(group => (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground">{group.label}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.items.map(reward => {
                const canAfford = myPoints >= reward.points_cost;
                return (
                  <div key={reward.id} className="rounded-xl border p-3 relative">
                    <button
                      onClick={() => setDeleteTarget(reward)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                      aria-label={`删除 ${reward.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <div className="text-2xl mb-1.5">{reward.icon}</div>
                    <p className="text-sm font-medium leading-tight pr-6">{reward.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{reward.points_cost} 分</p>
                    <Button
                      size="sm"
                      variant={canAfford ? 'default' : 'outline'}
                      disabled={!canAfford}
                      className="w-full mt-2.5 h-8 text-xs"
                      onClick={() => setRedeemTarget(reward)}
                    >
                      {canAfford ? '兑换' : `还差 ${reward.points_cost - myPoints}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* History */}
      {recentRedemptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground">兑换记录</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="divide-y">
            {recentRedemptions.map(r => {
              const m = members.find(x => x.id === r.member_id);
              return (
                <div key={r.id} className="flex items-center gap-2.5 py-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m?.avatar_color ?? '#999' }}
                  />
                  <span className="text-sm flex-1 truncate">{r.reward_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(r.redeemed_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">−{r.points_spent}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-2xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle className="text-base">新建奖励</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="奖励名称，例如：一次按摩" value={newName} onChange={e => setNewName(e.target.value)} maxLength={30} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="图标 🎁" value={newIcon} onChange={e => setNewIcon(e.target.value)} maxLength={4} />
              <Input placeholder="需要多少分" type="number" min={1} value={newCost} onChange={e => setNewCost(e.target.value)} />
            </div>
            <Input placeholder="分类（可选）" value={newCategory} onChange={e => setNewCategory(e.target.value)} maxLength={12} />
            <Button
              onClick={handleAdd}
              disabled={submitting || !newName.trim() || !newCost}
              className="w-full font-semibold"
            >
              {submitting ? '添加中…' : '添加'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redeem confirmation */}
      <AlertDialog open={!!redeemTarget} onOpenChange={o => { if (!o) setRedeemTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>兑换「{redeemTarget?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              将扣除 {redeemTarget?.points_cost} 分，兑换后剩余 {myPoints - (redeemTarget?.points_cost ?? 0)} 分。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRedeem} disabled={submitting}>
              {submitting ? '兑换中…' : '确认兑换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{deleteTarget?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>
              已经兑换过的记录会保留，只是这个奖励不再出现在列表里。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? '删除中…' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RewardsPage;
