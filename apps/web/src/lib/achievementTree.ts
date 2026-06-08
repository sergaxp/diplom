import type { AchievementResult } from './achievements';

// ── Геометрия раскладки (дерево растёт слева направо) ──────────
export const NODE_SIZE = 72;
export const COL_GAP = 260;
export const ROW_GAP = 120;
export const PAD = 80;

export type NodeVisibility = 'unlocked' | 'frontier' | 'locked' | 'hidden';

export interface TreeNode {
  ach: AchievementResult;
  column: number;
  /** Центр узла в координатах холста. */
  x: number;
  y: number;
  visibility: NodeVisibility;
  /** Секретное и ещё не открытое — показываем как «???». */
  isSecret: boolean;
}

export interface TreeEdge {
  id: string;
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Колонка-источник — для staggered-анимации «прорастания». */
  column: number;
  /** Ребро ведёт к уже открытому узлу. */
  active: boolean;
  /** Хотя бы один конец виден (не в тумане). */
  visible: boolean;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  maxColumn: number;
}

/**
 * Строит раскладку дерева достижений слева направо.
 *
 * В нашей модели у каждого достижения ровно один предок (или ноль у корня),
 * поэтому применяем классическую древовидную раскладку: листья получают
 * последовательные «слоты» по вертикали, родитель центрируется по детям.
 * Это даёт аккуратное дерево без пересечений рёбер.
 */
export function buildTree(achievements: AchievementResult[]): TreeLayout {
  const byId = new Map(achievements.map((a) => [a.id, a]));
  const root = achievements.find((a) => a.requires.length === 0);

  // Дети в порядке объявления (порядок определяет вертикальную развёртку).
  const children = new Map<string, string[]>();
  for (const a of achievements) {
    for (const p of a.requires) {
      const list = children.get(p);
      if (list) list.push(a.id);
      else children.set(p, [a.id]);
    }
  }

  // Глубина = длиннейший путь от корня (мемоизированно).
  const depth = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    const a = byId.get(id);
    const d =
      !a || a.requires.length === 0
        ? 0
        : 1 + Math.max(...a.requires.map(getDepth));
    depth.set(id, d);
    return d;
  };
  achievements.forEach((a) => getDepth(a.id));

  // Вертикальные слоты: листья по порядку, родитель — середина диапазона детей.
  const ySlot = new Map<string, number>();
  let nextLeaf = 0;
  const assignY = (id: string): number => {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      const y = nextLeaf++;
      ySlot.set(id, y);
      return y;
    }
    const ys = kids.map(assignY);
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    ySlot.set(id, y);
    return y;
  };
  if (root) assignY(root.id);
  // Защита от «висячих» узлов вне дерева корня.
  achievements.forEach((a) => {
    if (!ySlot.has(a.id)) ySlot.set(a.id, nextLeaf++);
  });

  // Туман войны на один шаг вглубь:
  //   unlocked → frontier (можно открыть, видно с описанием)
  //            → locked   (виден как «дальше есть ещё», без описания)
  //            → hidden   (не отображается вовсе)
  // Считаем по возрастанию глубины, чтобы предки были посчитаны раньше потомков.
  const visById = new Map<string, NodeVisibility>();
  const visibilityOf = (a: AchievementResult): NodeVisibility => {
    if (a.unlocked) return 'unlocked';
    if (a.requires.length === 0) return 'frontier';
    if (a.requires.every((p) => byId.get(p)?.unlocked)) return 'frontier';
    // Ровно один узел за границей — показатель того, что ветка продолжается.
    if (a.requires.some((p) => visById.get(p) === 'frontier')) return 'locked';
    return 'hidden';
  };
  [...achievements]
    .sort((x, y) => (depth.get(x.id) ?? 0) - (depth.get(y.id) ?? 0))
    .forEach((a) => visById.set(a.id, visibilityOf(a)));

  const centerX = (col: number) => PAD + NODE_SIZE / 2 + col * COL_GAP;
  const centerY = (slot: number) => PAD + NODE_SIZE / 2 + slot * ROW_GAP;

  const nodes: TreeNode[] = achievements.map((a) => {
    const column = depth.get(a.id) ?? 0;
    return {
      ach: a,
      column,
      x: centerX(column),
      y: centerY(ySlot.get(a.id) ?? 0),
      visibility: visById.get(a.id) ?? 'hidden',
      isSecret: !!a.secret && !a.unlocked,
    };
  });

  const nodeById = new Map(nodes.map((n) => [n.ach.id, n]));
  const edges: TreeEdge[] = [];
  for (const node of nodes) {
    for (const parentId of node.ach.requires) {
      const parent = nodeById.get(parentId);
      if (!parent) continue;
      edges.push({
        id: `${parentId}->${node.ach.id}`,
        from: parentId,
        to: node.ach.id,
        fromX: parent.x,
        fromY: parent.y,
        toX: node.x,
        toY: node.y,
        column: parent.column,
        active: node.ach.unlocked,
        // Туман войны: ребро рисуем только когда видны ОБА конца — иначе
        // оно вело бы к узлу-загадке, которого больше нет на экране.
        visible:
          parent.visibility !== 'hidden' && node.visibility !== 'hidden',
      });
    }
  }

  const maxColumn = nodes.reduce((m, n) => Math.max(m, n.column), 0);
  const maxSlot = Math.max(0, nextLeaf - 1);
  const width = PAD * 2 + NODE_SIZE + maxColumn * COL_GAP;
  const height = PAD * 2 + NODE_SIZE + maxSlot * ROW_GAP;

  return { nodes, edges, width, height, maxColumn };
}
