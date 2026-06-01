import { CATEGORIES, CATEGORY_META, type CategoryKey } from '../categories';

describe('CATEGORIES', () => {
  it('contains exactly 9 entries', () => {
    expect(CATEGORIES).toHaveLength(9);
  });

  it('every entry has a non-empty key, name, icon, and color', () => {
    for (const cat of CATEGORIES) {
      expect(cat.key).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
    }
  });

  it('every color is a valid hex string', () => {
    for (const cat of CATEGORIES) {
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keys are unique', () => {
    const keys = CATEGORIES.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('includes the expected canonical keys', () => {
    const keys = CATEGORIES.map(c => c.key);
    const required: CategoryKey[] = [
      'BILLS', 'TRANSPORT', 'FOOD', 'EDUCATION',
      'ENTERTAINMENT', 'SHOPPING', 'HEALTHCARE', 'SAVINGS', 'OTHERS',
    ];
    for (const k of required) {
      expect(keys).toContain(k);
    }
  });
});

describe('CATEGORY_META', () => {
  it('has an entry for every key in CATEGORIES', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_META[cat.key]).toBeDefined();
    }
  });

  it('meta name and color match CATEGORIES', () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_META[cat.key].name).toBe(cat.name);
      expect(CATEGORY_META[cat.key].color).toBe(cat.color);
    }
  });
});
