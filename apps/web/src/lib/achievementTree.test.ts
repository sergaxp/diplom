import { describe, it, expect } from 'vitest';
import { buildTree } from './achievementTree';
import type { AchievementResult } from './achievements';

// Хелпер для краткого построения достижений в тестах.
function ach(
  id: string,
  requires: string[],
  unlocked: boolean,
  extra: Partial<AchievementResult> = {},
): AchievementResult {
  return {
    id,
    title: id,
    description: id,
    rank: 1,
    xp: 500,
    icon: 'Star',
    requires,
    unlocked,
    ...extra,
  };
}

describe('buildTree', () => {
  // root → (a, b); a → c
  const base = () => [
    ach('root', [], true),
    ach('a', ['root'], true),
    ach('b', ['root'], false),
    ach('c', ['a'], false),
  ];

  it('назначает колонку = глубине от корня', () => {
    const { nodes } = buildTree(base());
    const col = (id: string) => nodes.find((n) => n.ach.id === id)!.column;
    expect(col('root')).toBe(0);
    expect(col('a')).toBe(1);
    expect(col('b')).toBe(1);
    expect(col('c')).toBe(2);
  });

  it('туман войны: открыт / граница / скрыто', () => {
    const { nodes } = buildTree(base());
    const vis = (id: string) => nodes.find((n) => n.ach.id === id)!.visibility;
    // open: открыт
    expect(vis('root')).toBe('unlocked');
    expect(vis('a')).toBe('unlocked');
    // b — закрыт, но предок (root) открыт → граница
    expect(vis('b')).toBe('frontier');
    // c — предок (a) открыт → тоже граница
    expect(vis('c')).toBe('frontier');
  });

  it('показывает один узел-«дальше есть ещё» за границей, остальное скрывает', () => {
    // root открыт → a граница; c (за a) — «locked» (виден без описания);
    // d (за c) — уже скрыт.
    const nodes = [
      ach('root', [], true),
      ach('a', ['root'], false),
      ach('c', ['a'], false),
      ach('d', ['c'], false),
    ];
    const { nodes: built } = buildTree(nodes);
    const vis = (id: string) => built.find((n) => n.ach.id === id)!.visibility;
    expect(vis('a')).toBe('frontier');
    expect(vis('c')).toBe('locked');
    expect(vis('d')).toBe('hidden');
  });

  it('секретное и не открытое помечается isSecret', () => {
    const nodes = [
      ach('root', [], true),
      ach('s', ['root'], false, { secret: true }),
    ];
    const { nodes: built } = buildTree(nodes);
    expect(built.find((n) => n.ach.id === 's')!.isSecret).toBe(true);
  });

  it('строит ребро на каждую связь requires, active — к открытому узлу', () => {
    const { edges } = buildTree(base());
    expect(edges).toHaveLength(3);
    const byId = new Map(edges.map((e) => [e.id, e]));
    expect(byId.get('root->a')!.active).toBe(true);
    expect(byId.get('root->b')!.active).toBe(false);
  });
});
