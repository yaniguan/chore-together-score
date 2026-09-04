import React from 'react';
import {
  AirVent, Archive, Armchair, Bath, Bed, BedDouble, Bird, Blinds, Bone, Box, Boxes,
  Brush, Cat, ChefHat, Clock, Coffee, Container, CookingPot, Dog, DoorOpen, Droplets,
  Egg, Fan, Flame, Footprints, Frame, GlassWater, Hammer, Heart, House, Lamp, Layers,
  Lightbulb, Mailbox, Microwave, Milk, Package, PaintBucket, PaintRoller, PawPrint,
  Pill, Plug, Recycle, Refrigerator, Scissors, ShoppingBag, ShowerHead, Shirt,
  Snowflake, Sofa, Soup, Sparkles, SprayCan, Star, Sun, Toilet, Tornado, Trash2,
  Utensils, Wallet, Wallpaper, WashingMachine, Waves, Wind, Wrench,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for task iconography. The `icon` column stores one of
// these kebab-case keys; anything unrecognised (e.g. the emoji that older rows
// still carry) falls back to rendering the raw string, so existing households
// keep working without a data migration.
export const TASK_ICONS: Record<string, LucideIcon> = {
  'air-vent': AirVent,
  archive: Archive,
  armchair: Armchair,
  bath: Bath,
  bed: Bed,
  'bed-double': BedDouble,
  bird: Bird,
  blinds: Blinds,
  bone: Bone,
  box: Box,
  boxes: Boxes,
  brush: Brush,
  cat: Cat,
  'chef-hat': ChefHat,
  clock: Clock,
  coffee: Coffee,
  container: Container,
  'cooking-pot': CookingPot,
  dog: Dog,
  door: DoorOpen,
  droplets: Droplets,
  egg: Egg,
  fan: Fan,
  flame: Flame,
  footprints: Footprints,
  frame: Frame,
  'glass-water': GlassWater,
  hammer: Hammer,
  heart: Heart,
  house: House,
  lamp: Lamp,
  layers: Layers,
  lightbulb: Lightbulb,
  mailbox: Mailbox,
  microwave: Microwave,
  milk: Milk,
  package: Package,
  'paint-bucket': PaintBucket,
  'paint-roller': PaintRoller,
  paw: PawPrint,
  pill: Pill,
  plug: Plug,
  recycle: Recycle,
  refrigerator: Refrigerator,
  scissors: Scissors,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  shower: ShowerHead,
  snowflake: Snowflake,
  sofa: Sofa,
  soup: Soup,
  sparkles: Sparkles,
  spray: SprayCan,
  star: Star,
  sun: Sun,
  toilet: Toilet,
  tornado: Tornado,
  trash: Trash2,
  utensils: Utensils,
  wallet: Wallet,
  wallpaper: Wallpaper,
  'washing-machine': WashingMachine,
  waves: Waves,
  wind: Wind,
  wrench: Wrench,
};

// Picker layout — grouped so the dialog reads as "pick from this area first".
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: '厨房',
    icons: ['cooking-pot', 'chef-hat', 'utensils', 'soup', 'egg', 'flame', 'refrigerator',
            'microwave', 'air-vent', 'glass-water', 'milk', 'coffee', 'container', 'layers'],
  },
  {
    label: '卫生间',
    icons: ['shower', 'bath', 'toilet', 'droplets', 'waves', 'frame', 'spray', 'brush', 'pill'],
  },
  {
    label: '打扫',
    icons: ['sparkles', 'wind', 'tornado', 'paint-roller', 'paint-bucket', 'trash', 'recycle',
            'door', 'blinds', 'wallpaper', 'lightbulb', 'plug', 'fan', 'snowflake', 'sofa',
            'armchair', 'lamp', 'boxes', 'archive', 'hammer', 'wrench', 'house'],
  },
  {
    label: '洗衣',
    icons: ['washing-machine', 'shirt', 'bed', 'bed-double', 'sun'],
  },
  {
    label: '狗',
    icons: ['dog', 'bone', 'paw', 'footprints', 'cat', 'bird'],
  },
  {
    label: '其他',
    icons: ['shopping-bag', 'package', 'box', 'wallet', 'mailbox', 'clock', 'star', 'heart', 'scissors'],
  },
];

export const isKnownIcon = (name: string | null | undefined): boolean =>
  !!name && name in TASK_ICONS;

/**
 * Renders a task icon. Falls back to the raw string for legacy emoji rows so
 * nothing ever renders blank.
 */
export const TaskIcon: React.FC<{ name: string | null | undefined; className?: string }> = ({
  name,
  className = 'w-5 h-5',
}) => {
  const Icon = name ? TASK_ICONS[name] : undefined;
  if (Icon) return <Icon className={className} strokeWidth={1.75} />;
  // Legacy emoji (or an unknown key) — render as text, sized off the class.
  if (name) return <span className={`${className} inline-flex items-center justify-center leading-none`}>{name}</span>;
  return <Sparkles className={className} strokeWidth={1.75} />;
};
