import React, { useState } from 'react';
import { useHousehold, Reward } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Gift, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    });
    await refreshData();
    setShowAddDialog(false);
    setNewName('');
    setNewIcon('🎁');
    setNewCost('');
    setSubmitting(false);
  };

  const handleDeleteReward = async (rewardId: string) => {
    await supabase.from('rewards').delete().eq('id', rewardId);
    await refreshData();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-foreground">Rewards</h1>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-5">
        <p className="text-sm font-semibold text-muted-foreground mb-3">Available Points</p>
        <div className="grid grid-cols-2 gap-3">
          {members.map(m => (
            <div key={m.id} className="text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center text-sm font-bold text-primary-foreground"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.display_name.charAt(0)}
              </div>
              <p className="text-sm font-semibold text-foreground">{m.display_name}</p>
              <p className="text-2xl font-extrabold" style={{ color: m.avatar_color }}>
                🪙 {availablePoints[m.id] ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">pts available</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Rewards list */}
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
          <div className="grid grid-cols-2 gap-3">
            {rewards.map(reward => {
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
            })}
          </div>
        )}
      </motion.div>

      {/* Redemption History */}
      {redemptions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-2xl border p-5">
          <h2 className="font-bold text-foreground mb-3">Redemption History</h2>
          <div className="space-y-2">
            {redemptions.map(r => {
              const member = members.find(m => m.id === r.member_id);
              const date = new Date(r.redeemed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' });
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
                      <span className="font-semibold">{member?.display_name}</span> redeemed "{r.reward_name}"
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-muted-foreground text-xs">{date}</p>
                    <p className="text-destructive font-semibold text-xs">-{r.points_spent} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
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
