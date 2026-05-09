import React, { useMemo, useState } from 'react';
import { useHousehold } from '@/context/HouseholdContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShoppingCart, Trash2, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const ShoppingPage: React.FC = () => {
  const { householdId, currentMember, members, shoppingItems, refreshData } = useHousehold();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { active, done } = useMemo(() => {
    const a = shoppingItems.filter(i => !i.completed_at);
    const d = shoppingItems.filter(i => i.completed_at)
      .sort((x, y) => (y.completed_at ?? '').localeCompare(x.completed_at ?? ''))
      .slice(0, 30);
    return { active: a, done: d };
  }, [shoppingItems]);

  const reportError = (action: string, message: string | undefined) => {
    if (message?.includes('shopping_items') || message?.includes('relation')) {
      toast.error('购物清单表还没建好，请先在 Supabase 后台跑迁移 SQL', { duration: 6000 });
    } else {
      toast.error(`${action}失败: ${message ?? '未知错误'}`);
    }
  };

  const handleAdd = async () => {
    const n = name.trim();
    if (!n || !householdId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('shopping_items').insert({
        household_id: householdId,
        name: n,
        quantity: quantity.trim() || null,
        added_by: currentMember?.id ?? null,
      });
      if (error) {
        reportError('添加', error.message);
        return;
      }
      setName('');
      setQuantity('');
      await refreshData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, isDone: boolean) => {
    if (!householdId) return;
    const { error } = await supabase.from('shopping_items').update({
      completed_at: isDone ? null : new Date().toISOString(),
      completed_by: isDone ? null : (currentMember?.id ?? null),
    }).eq('id', id);
    if (error) {
      reportError('更新', error.message);
      return;
    }
    await refreshData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('shopping_items').delete().eq('id', id);
    if (error) {
      reportError('删除', error.message);
      return;
    }
    await refreshData();
  };

  const findMember = (id: string | null) => members.find(m => m.id === id);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShoppingCart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-extrabold text-foreground">购物清单</h1>
      </div>

      {/* Add row */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border p-4 space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="想买什么? 例如: 牛奶"
            className="rounded-xl flex-1"
            maxLength={80}
          />
          <Input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="数量"
            className="rounded-xl w-24"
            maxLength={20}
          />
        </div>
        <Button onClick={handleAdd} disabled={!name.trim() || submitting} className="w-full rounded-xl h-10 font-bold">
          <Plus className="w-4 h-4 mr-1" /> 加入清单
        </Button>
      </motion.div>

      {/* Active items */}
      <div>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
          待买 ({active.length})
        </p>
        {active.length === 0 ? (
          <div className="bg-card rounded-2xl border p-8 text-center text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">清单是空的</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {active.map(item => {
                const adder = findMember(item.added_by);
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-card rounded-2xl border p-3 flex items-center gap-3"
                  >
                    <button
                      onClick={() => handleToggle(item.id, false)}
                      className="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 hover:border-primary transition-colors"
                      aria-label="标记为已购"
                    >
                      <Check className="w-4 h-4 text-transparent" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {item.quantity && <span className="font-semibold">×{item.quantity}</span>}
                        {adder && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: adder.avatar_color }} />
                            {adder.display_name.split(' ')[0]} 添加
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      aria-label="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Recently bought */}
      {done.length > 0 && (
        <div>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-2">
            已购 (最近 {done.length})
          </p>
          <div className="space-y-2">
            {done.map(item => {
              const buyer = findMember(item.completed_by);
              return (
                <div
                  key={item.id}
                  className="bg-card/60 rounded-2xl border p-3 flex items-center gap-3 opacity-70"
                >
                  <button
                    onClick={() => handleToggle(item.id, true)}
                    className="w-8 h-8 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center flex-shrink-0"
                    aria-label="移回待买"
                    title="移回待买"
                  >
                    <Check className="w-4 h-4 text-primary" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate line-through">{item.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {item.quantity && <span className="font-semibold">×{item.quantity}</span>}
                      {buyer && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: buyer.avatar_color }} />
                          {buyer.display_name.split(' ')[0]} 已购
                        </span>
                      )}
                      {item.completed_at && (
                        <span>{new Date(item.completed_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(item.id, true)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    aria-label="移回待买"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingPage;
