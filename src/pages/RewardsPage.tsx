import React, { useState, useMemo } from 'react';
import { useHousehold, Reward } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Gift, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const RewardsPage: React.FC = () => {
  const { householdId, currentMember, members, rewards, redemptions, availablePoints, refreshData } = useHousehold();

  const [redeemTarget, setRedeemTarget] = useState<Reward | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🎁');
  const [newCost, setNewCost] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myPoints = currentMember ? (availablePoints[currentMember.id] ?? 0) : 0;

  const handleRedeem = async () => {
    if (!redeemTarget || !currentMember || !householdId) return;
    setSubmitting(true);
    await supabase.from('redemptions').insert({
      household_id: householdId,
      member_id: currentMember.id,
      reward_id: redeemTarget.id,
      reward_name: redeemTarget.name,
      points_spent: redeemTarget.points_cost,
    });
    await refreshData();
    setRedeemTarget(null);
    setSubmitting(false);
  };

  const handleAddReward = async () => {
    const cost = parseInt(newCost, 10);
    if (!newName.trim() || isNaN(cost) || cost <= 0 || !householdId) return;
    setSubmitting(true);
    await supabase.from('rewards').insert({
      household_id: householdId,
      name: newName.trim(),
      icon: newIcon || '🎁',
      points_cost: cost,
      category: newCategory.trim() || null,
    });
    await refreshData();
    setShowAddDialog(false);
    setNewName('');
    setNewIcon('🎁');
    setNewCost('');
    setNewCategory('');
    setSubmitting(false);
  };

  const handleDeleteReward = async (rewardId: string) => {
    await supabase.from('rewards').delete().eq('id', rewardId);
    await refreshData();
  };

  // Group rewards by category
  const groupedRewards = useMemo(() => {
    const groups: Record<string, Reward[]> = {};
    for (const r of rewards) {
      const key = r.category?.trim() || '未分类';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    // Sort: named categories alphabetically, '未分类' last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === '未分类') return 1;
      if (b === '未分类') return -1;
      return a.localeCompare(b);
    });
  }, [rewards]);

  // Points progress to next unaffordable reward (sort rewards once, not per member)
  const pointsProgress = useMemo(() => {
    const sortedRewards = [...rewards].sort((a, b) => a.points_cost - b.points_cost);
    return members.map(m => {
      const pts = availablePoints[m.id] ?? 0;
      const nextReward = sortedRewards.find(r => r.points_cost > pts);
      return { ...m, pts, nextReward };
    });
  }, [members, rewards, availablePoints]);

  const renderRewardCard = (reward: Reward) => {
    const canAfford = myPoints >= reward.points_cost;
    return (
      <div key={reward.id} className="bg-card rounded-2xl border p-4 flex flex-col items-center text-center relative">
        <button
          className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => handleDeleteReward(reward.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className="text-3xl mb-2">{reward.icon}</span>
        <p className="font-semibold text-sm text-foreground leading-tight">{reward.name}</p>
        <p className="text-sm font-bold text-primary mt-1">🪙 {reward.points_cost} pts</p>
        {canAfford ? (
          <Button size="sm" className="mt-3 w-full" onClick={() => setRedeemTarget(reward)}>
            Redeem
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="mt-3 w-full">
                <Button size="sm" className="w-full" disabled>
                  Redeem
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Need {reward.points_cost - myPoints} more pts</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Rewards</h1>

      {/* Balance + Progress */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-5 space-y-4">
        <p className="text-sm font-semibold text-muted-foreground">Available Points</p>
        <div className="space-y-4">
          {pointsProgress.map(m => {
            const progressPct = m.nextReward ? Math.min(100, (m.pts / m.nextReward.points_cost) * 100) : 100;
            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0"
                    style={{ backgroundColor: m.avatar_color }}
                  >
                    {m.display_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-sm font-semibold text-foreground truncate">{m.display_name}</span>
                      <span className="text-lg font-extrabold flex-shrink-0" style={{ color: m.avatar_color }}>🪙 {m.pts}</span>
                    </div>
                    {m.nextReward ? (
                      <p className="text-[11px] text-muted-foreground truncate">距兑换"{m.nextReward.name}"还差 {m.nextReward.points_cost - m.pts} 分</p>
                    ) : (
                      <p className="text-[11px] text-green-600 font-semibold">可兑换所有奖励!</p>
                    )}
                  </div>
                </div>
                <Progress value={progressPct} className="h-1.5" style={{ '--progress-color': m.avatar_color } as React.CSSProperties} />
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Rewards list — grouped by category */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" /> Available Rewards
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {rewards.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
            <Gift className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No rewards yet. Add one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedRewards.map(([category, catRewards]) => (
              <div key={category}>
                {groupedRewards.length > 1 && (
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{category}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {catRewards.map(renderRewardCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl border p-5">
          <h2 className="font-bold text-foreground mb-3">Redemption History</h2>
          <Tabs defaultValue="all">
            <TabsList className="mb-3 h-8">
              <TabsTrigger value="all" className="text-xs h-7">All</TabsTrigger>
              {members.map(m => (
                <TabsTrigger key={m.id} value={m.id} className="text-xs h-7">{m.display_name.split(' ')[0]}</TabsTrigger>
              ))}
            </TabsList>

            {['all', ...members.map(m => m.id)].map(tabId => {
              const filtered = tabId === 'all' ? redemptions : redemptions.filter(r => r.member_id === tabId);
              const byDate = filtered.reduce<Record<string, typeof redemptions>>((acc, r) => {
                const key = new Date(r.redeemed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
                if (!acc[key]) acc[key] = [];
                acc[key].push(r);
                return acc;
              }, {});

              return (
                <TabsContent key={tabId} value={tabId} className="mt-0 space-y-3">
                  {Object.entries(byDate).map(([date, items]) => (
                    <div key={date}>
                      <p className="text-[11px] font-bold text-muted-foreground mb-1.5">{date}</p>
                      <div className="space-y-2">
                        {items.map(r => {
                          const member = members.find(m => m.id === r.member_id);
                          return (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground"
                                  style={{ backgroundColor: member?.avatar_color ?? '#888' }}
                                >
                                  {member?.display_name.charAt(0)}
                                </div>
                                <span className="text-foreground">
                                  <span className="font-semibold">{member?.display_name.split(' ')[0]}</span> · {r.reward_name}
                                </span>
                              </div>
                              <p className="text-destructive font-semibold text-xs shrink-0 ml-2">-{r.points_spent} pts</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No redemptions yet</p>}
                </TabsContent>
              );
            })}
          </Tabs>
        </motion.div>
      )}

      {/* Redeem confirmation dialog */}
      <AlertDialog open={!!redeemTarget} onOpenChange={open => { if (!open) setRedeemTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem "{redeemTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deduct {redeemTarget?.points_cost} points from {currentMember?.display_name}'s balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRedeem} disabled={submitting}>
              {submitting ? 'Redeeming...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add reward dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Reward</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reward-icon">Emoji</Label>
              <Input
                id="reward-icon"
                value={newIcon}
                onChange={e => setNewIcon(e.target.value)}
                placeholder="🎁"
                className="mt-1"
                maxLength={4}
              />
            </div>
            <div>
              <Label htmlFor="reward-name">Name</Label>
              <Input
                id="reward-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Movie Night"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reward-cost">Points Cost</Label>
              <Input
                id="reward-cost"
                type="number"
                min={1}
                value={newCost}
                onChange={e => setNewCost(e.target.value)}
                placeholder="e.g. 20"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reward-category">Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="reward-category"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value.slice(0, 20))}
                placeholder="e.g. 娱乐 / 食物 / 休息"
                className="mt-1"
                maxLength={20}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={!newName.trim() || !newCost || parseInt(newCost) <= 0 || submitting}
                onClick={handleAddReward}
              >
                {submitting ? 'Saving...' : 'Add Reward'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardsPage;
