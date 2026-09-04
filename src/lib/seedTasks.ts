import type { CategoryValue, FrequencyValue } from '@/lib/constants';

export interface SeedTask {
  name: string;
  icon: string;
  category: CategoryValue;
  frequency: FrequencyValue;
  frequency_value: number;
  max_per_cycle: number;
  points: number;
  color_tag: string;
}

// One accent per area — the palette stays flat and the icons stay monochrome,
// so colour only ever encodes "which room", never "which task".
export const CATEGORY_COLORS: Record<CategoryValue, string> = {
  kitchen:  '#F59E0B',
  bathroom: '#3B82F6',
  cleaning: '#10B981',
  laundry:  '#8B5CF6',
  dog:      '#F97066',
  other:    '#6B7280',
};

const t = (
  name: string,
  icon: string,
  category: CategoryValue,
  frequency: FrequencyValue,
  max_per_cycle: number,
  points: number,
): SeedTask => ({
  name,
  icon,
  category,
  frequency,
  frequency_value: 1,
  max_per_cycle,
  points,
  color_tag: CATEGORY_COLORS[category],
});

// Default chore list for a 1b1b apartment with a dog and in-unit laundry.
// `max_per_cycle` is kept for the column's sake but no longer caps anything —
// a chore can be logged as many times as it was actually done.
export const SEED_TASKS: SeedTask[] = [
  // ── 厨房 ────────────────────────────────────────────────────────────────
  t('做饭',          'cooking-pot',     'kitchen',  'daily',   2, 6),
  t('洗碗',          'utensils',        'kitchen',  'daily',   3, 4),
  t('擦灶台',        'flame',           'kitchen',  'daily',   1, 3),
  t('擦台面',        'sparkles',        'kitchen',  'daily',   1, 3),
  t('洗水槽',        'droplets',        'kitchen',  'daily',   1, 3),
  t('倒厨余垃圾',    'trash',           'kitchen',  'daily',   2, 3),
  t('换锡纸',        'layers',          'kitchen',  'weekly',  1, 2),
  t('擦微波炉',      'microwave',       'kitchen',  'weekly',  1, 3),
  t('理冰箱',        'refrigerator',    'kitchen',  'weekly',  1, 5),
  t('擦橱柜门',      'box',             'kitchen',  'monthly', 1, 4),
  t('洗油烟机',      'air-vent',        'kitchen',  'monthly', 1, 8),
  t('洗烤箱',        'container',       'kitchen',  'monthly', 1, 8),
  t('洗垃圾桶',      'recycle',         'kitchen',  'monthly', 1, 4),
  t('补充厨房用品',  'shopping-bag',    'kitchen',  'monthly', 1, 3),

  // ── 卫生间 ──────────────────────────────────────────────────────────────
  t('刷马桶',        'toilet',          'bathroom', 'weekly',  2, 5),
  t('刷浴缸',        'bath',            'bathroom', 'weekly',  1, 6),
  t('洗手池',        'waves',           'bathroom', 'weekly',  2, 3),
  t('擦镜子',        'frame',           'bathroom', 'weekly',  1, 2),
  t('拖卫生间地',    'paint-roller',    'bathroom', 'weekly',  1, 4),
  t('倒卫生间垃圾',  'trash',           'bathroom', 'weekly',  2, 2),
  t('换厕纸',        'package',         'bathroom', 'weekly',  1, 1),
  t('清下水口',      'brush',           'bathroom', 'monthly', 1, 4),
  t('洗浴帘',        'shower',          'bathroom', 'monthly', 1, 4),
  t('补充洗漱用品',  'pill',            'bathroom', 'monthly', 1, 3),

  // ── 打扫 ────────────────────────────────────────────────────────────────
  t('扫地',          'wind',            'cleaning', 'daily',   1, 4),
  t('收拾杂物',      'boxes',           'cleaning', 'daily',   1, 3),
  t('倒垃圾下楼',    'recycle',         'cleaning', 'daily',   1, 3),
  t('拖地',          'paint-roller',    'cleaning', 'weekly',  2, 6),
  t('擦灰',          'sparkles',        'cleaning', 'weekly',  1, 4),
  t('吸尘',          'tornado',         'cleaning', 'weekly',  1, 5),
  t('擦门把手开关',  'door',            'cleaning', 'monthly', 1, 2),
  t('擦窗户',        'blinds',          'cleaning', 'monthly', 1, 6),
  t('换空调滤网',    'snowflake',       'cleaning', 'monthly', 1, 5),
  t('换灯泡小修',    'wrench',          'cleaning', 'monthly', 1, 3),

  // ── 洗衣 ────────────────────────────────────────────────────────────────
  t('铺床',          'bed',             'laundry',  'daily',   1, 1),
  t('洗衣服',        'washing-machine', 'laundry',  'weekly',  3, 4),
  t('烘干晾衣服',    'sun',             'laundry',  'weekly',  3, 3),
  t('叠衣服',        'shirt',           'laundry',  'weekly',  3, 4),
  t('收衣服归位',    'archive',         'laundry',  'weekly',  3, 3),
  t('洗毛巾',        'droplets',        'laundry',  'weekly',  1, 2),
  t('洗床品',        'bed-double',      'laundry',  'weekly',  1, 5),
  t('铺床品',        'layers',          'laundry',  'weekly',  1, 4),

  // ── 狗 ──────────────────────────────────────────────────────────────────
  t('遛狗',          'footprints',      'dog',      'daily',   3, 5),
  t('喂饭',          'bone',            'dog',      'daily',   2, 2),
  t('换水',          'glass-water',     'dog',      'daily',   1, 1),
  t('捡便便',        'paw',             'dog',      'daily',   2, 3),
  t('给狗刷牙',      'brush',           'dog',      'daily',   1, 2),
  t('梳毛',          'dog',             'dog',      'weekly',  2, 2),
  t('给狗洗澡',      'bath',            'dog',      'monthly', 1, 8),
  t('剪指甲',        'scissors',        'dog',      'monthly', 1, 4),
  t('洗狗窝',        'box',             'dog',      'monthly', 1, 4),
];
