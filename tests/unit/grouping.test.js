import { describe, expect, it } from 'vitest';
import { groupDatesByYear } from '../../src/lib/grouping.js';

describe('groupDatesByYear', () => {
  it('returns nothing for no dates', () => { expect(groupDatesByYear([])).toEqual([]); });

  it('groups by year, month and week with newest years first', () => {
    const result = groupDatesByYear(['2026-10-20', '2026-10-19', '2026-10-19', '2025-12-30', '2026-10-27']);
    expect(result.map(([year]) => year)).toEqual(['2026', '2025']);
    const [, months] = result[0];
    expect(months).toHaveLength(1);
    const [key, month] = months[0];
    expect(key).toBe('2026-10');
    expect(month.weeks).toEqual([['2026-10-19', ['2026-10-19', '2026-10-20']], ['2026-10-26', ['2026-10-27']]]);
  });
});
