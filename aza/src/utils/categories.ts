export type CategoryKey = 'BILLS' | 'TRANSPORT' | 'FOOD' | 'EDUCATION' | 'ENTERTAINMENT' | 'SHOPPING' | 'HEALTHCARE' | 'SAVINGS' | 'OTHERS';

export interface CategoryInfo {
  key: CategoryKey;
  name: string;
  icon: string;
  color: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { key: 'BILLS',         name: 'Bills & Utilities', icon: 'zap',            color: '#3B82F6' },
  { key: 'TRANSPORT',     name: 'Transport',         icon: 'navigation',     color: '#10B981' },
  { key: 'FOOD',          name: 'Food & Drinks',     icon: 'coffee',         color: '#F59E0B' },
  { key: 'EDUCATION',     name: 'Education',         icon: 'book-open',      color: '#8B5CF6' },
  { key: 'ENTERTAINMENT', name: 'Entertainment',     icon: 'film',           color: '#EC4899' },
  { key: 'SHOPPING',      name: 'Shopping',          icon: 'shopping-bag',   color: '#F97316' },
  { key: 'HEALTHCARE',    name: 'Healthcare',        icon: 'heart',          color: '#EF4444' },
  { key: 'SAVINGS',       name: 'Savings',           icon: 'trending-up',    color: '#14B8A6' },
  { key: 'OTHERS',        name: 'Others',            icon: 'more-horizontal', color: '#64748B' },
];

export const CATEGORY_META: Record<CategoryKey, Omit<CategoryInfo, 'key'>> = CATEGORIES.reduce((acc, cat) => {
  acc[cat.key] = { name: cat.name, icon: cat.icon, color: cat.color };
  return acc;
}, {} as Record<CategoryKey, Omit<CategoryInfo, 'key'>>);
