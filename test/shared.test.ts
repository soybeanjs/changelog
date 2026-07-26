import { describe, expect, it, vi } from 'vitest';
import { capitalize, groupBy, join, notNullish, partition, upperFirst } from '../src/shared';

describe('shared utilities', () => {
  describe('notNullish', () => {
    it('should return false for null', () => {
      expect(notNullish(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(notNullish(undefined)).toBe(false);
    });

    it('should return true for empty string', () => {
      expect(notNullish('')).toBe(true);
    });

    it('should return true for 0', () => {
      expect(notNullish(0)).toBe(true);
    });

    it('should return true for false', () => {
      expect(notNullish(false)).toBe(true);
    });

    it('should return true for objects and arrays', () => {
      expect(notNullish({})).toBe(true);
      expect(notNullish([])).toBe(true);
    });

    it('should work as type guard in filter', () => {
      const arr = [1, null, 2, undefined, 3];
      const filtered = arr.filter(notNullish);
      expect(filtered).toEqual([1, 2, 3]);
    });
  });

  describe('partition', () => {
    it('should partition array into two parts with one filter', () => {
      const [even, odd] = partition([1, 2, 3, 4, 5, 6], n => n % 2 === 0);
      expect(even).toEqual([2, 4, 6]);
      expect(odd).toEqual([1, 3, 5]);
    });

    it('should partition empty array', () => {
      const [a, b] = partition([] as number[], n => n > 0);
      expect(a).toEqual([]);
      expect(b).toEqual([]);
    });

    it('should put all items in first partition when all match', () => {
      const [matched, rest] = partition([1, 2, 3], () => true);
      expect(matched).toEqual([1, 2, 3]);
      expect(rest).toEqual([]);
    });

    it('should put all items in last partition when none match', () => {
      const [matched, rest] = partition([1, 2, 3], () => false);
      expect(matched).toEqual([]);
      expect(rest).toEqual([1, 2, 3]);
    });

    it('should partition with multiple filters', () => {
      const [small, medium, large] = partition(
        [1, 5, 10, 15, 20, 25],
        n => n < 5,
        n => n < 20
      );
      expect(small).toEqual([1]);
      expect(medium).toEqual([5, 10, 15]);
      expect(large).toEqual([20, 25]);
    });

    it('should provide index and array to filter function', () => {
      const filter = vi.fn((item: number, idx: number, arr: number[]) => idx < arr.length / 2);
      partition([10, 20, 30, 40], filter);
      expect(filter).toHaveBeenCalledWith(10, 0, [10, 20, 30, 40]);
      expect(filter).toHaveBeenCalledWith(20, 1, [10, 20, 30, 40]);
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'feat', name: 'a' },
        { type: 'fix', name: 'b' },
        { type: 'feat', name: 'c' }
      ];
      const grouped = groupBy(items, 'type');
      expect(Object.keys(grouped)).toEqual(['feat', 'fix']);
      expect(grouped['feat']).toHaveLength(2);
      expect(grouped['fix']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const grouped = groupBy([], 'type');
      expect(grouped).toEqual({});
    });

    it('should use existing groups object if provided', () => {
      const existing = { feat: [{ type: 'feat', name: 'existing' }] };
      const items = [{ type: 'feat', name: 'new' }];
      const grouped = groupBy(items, 'type', existing);
      expect(grouped['feat']).toHaveLength(2);
      expect(grouped).toBe(existing);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should leave already capitalized strings unchanged', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('join', () => {
    it('should return empty string for undefined/null', () => {
      expect(join(undefined)).toBe('');
      expect(join(null as any)).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(join([])).toBe('');
    });

    it('should return single item for one element', () => {
      expect(join(['a'])).toBe('a');
    });

    it('should use finalGlue for two elements', () => {
      expect(join(['a', 'b'])).toBe('a and b');
    });

    it('should use custom finalGlue for two elements', () => {
      expect(join(['a', 'b'], ', ', ' & ')).toBe('a & b');
    });

    it('should use glue for multiple elements and finalGlue for last', () => {
      expect(join(['a', 'b', 'c'])).toBe('a, b and c');
    });

    it('should use custom glue and finalGlue', () => {
      expect(join(['a', 'b', 'c', 'd'], '; ', ' or ')).toBe('a; b; c or d');
    });
  });

  describe('upperFirst', () => {
    it('should uppercase first character', () => {
      expect(upperFirst('hello')).toBe('Hello');
    });

    it('should return empty string for undefined', () => {
      expect(upperFirst(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(upperFirst('')).toBe('');
    });

    it('should leave already uppercase first char unchanged', () => {
      expect(upperFirst('Hello')).toBe('Hello');
    });
  });
});
