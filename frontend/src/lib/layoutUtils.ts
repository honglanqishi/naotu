import type { Node, Edge } from '@xyflow/react';

export type LayoutStyle = 'mindmap' | 'tree-lr' | 'tree-tb';
export type NodeSide = 'left' | 'right';

const H_GAP = 220; // 水平节点间距
const V_GAP = 70;  // 垂直节点间距
const NODE_H = 40; // 估算节点高度

/** 构建从 nodeId  childrenIds 的邻接表（仅层级边） */
function buildTree(nodes: Node[], edges: Edge[]): Map<string, string[]> {
  const childrenMap = new Map<string, string[]>();
  nodes.forEach((n) => childrenMap.set(n.id, []));
  edges.forEach((e) => {
    if ((e.type === 'hierarchyEdge' || !e.type) && childrenMap.has(e.source)) {
      childrenMap.get(e.source)!.push(e.target);
    }
  });
  return childrenMap;
}

/**
 * 计算子树占用的垂直高度：
 * - 无子节点  NODE_H
 * - 1 个子节点  与父节点同 Y，高度 = 子树高度
 * - 多子节点  各子树高度之和 + 间距
 */
function makeSubtreeHeight(childrenMap: Map<string, string[]>) {
  function subtreeHeight(nodeId: string): number {
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return NODE_H;
    if (children.length === 1) return subtreeHeight(children[0]);
    const total = children.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    return Math.max(NODE_H, total);
  }
  return subtreeHeight;
}

/** 递归放置子树，记录 sideMap（每个节点属于哪侧） */
function makePlaceSubtree(
  childrenMap: Map<string, string[]>,
  subtreeHeight: (id: string) => number,
  posMap: Map<string, { x: number; y: number }>,
  sideMap: Map<string, NodeSide>,
) {
  function place(nodeId: string, cx: number, cy: number, direction: NodeSide) {
    posMap.set(nodeId, { x: cx, y: cy });
    sideMap.set(nodeId, direction);
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return;

    const childX = direction === 'right' ? cx + H_GAP : cx - H_GAP;

    if (children.length === 1) {
      // 单子节点：保持同 Y，直连直线
      place(children[0], childX, cy, direction);
      return;
    }

    // 多子节点：垂直均匀分布，父节点居中
    const totalH = children.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = cy - totalH / 2;
    children.forEach((childId) => {
      const h = subtreeHeight(childId);
      place(childId, childX, startY + h / 2, direction);
      startY += h + V_GAP;
    });
  }
  return place;
}

/**
 * mindmap 布局：根节点居中，子节点左右展开。
 * 优先读取节点的 data.side 固定已有节点方向；
 * 没有 side 的新节点默认放右侧。
 */
function layoutMindmap(
  rootId: string,
  nodes: Node[],
  edges: Edge[],
): { posMap: Map<string, { x: number; y: number }>; sideMap: Map<string, NodeSide> } {
  const childrenMap = buildTree(nodes, edges);
  const posMap = new Map<string, { x: number; y: number }>();
  const sideMap = new Map<string, NodeSide>();
  const subtreeHeight = makeSubtreeHeight(childrenMap);
  const place = makePlaceSubtree(childrenMap, subtreeHeight, posMap, sideMap);

  // 根节点本身放在原点
  posMap.set(rootId, { x: 0, y: 0 });
  sideMap.set(rootId, 'right'); // 根节点 side 无意义，给个默认值

  const nodeDataMap = new Map(nodes.map((n) => [n.id, n.data]));
  const rootChildren = childrenMap.get(rootId) ?? [];

  // 分组：已有 side 的固定；没有 side 的，偶数索引右，奇数索引左
  const rightChildren: string[] = [];
  const leftChildren: string[] = [];
  let unassignedIdx = 0; // 用于未分配节点的奇偶计数

  rootChildren.forEach((childId) => {
    const side = nodeDataMap.get(childId)?.side as NodeSide | undefined;
    if (side === 'left') {
      leftChildren.push(childId);
    } else if (side === 'right') {
      rightChildren.push(childId);
    } else {
      // 没有 side：按奇偶分配（第 0、2、4... 个  右，第 1、3、5... 个  左）
      if (unassignedIdx % 2 === 0) {
        rightChildren.push(childId);
      } else {
        leftChildren.push(childId);
      }
      unassignedIdx++;
    }
  });

  // 放置右侧分支
  if (rightChildren.length === 1) {
    place(rightChildren[0], H_GAP, 0, 'right');
  } else if (rightChildren.length > 1) {
    const totalH = rightChildren.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = -totalH / 2;
    rightChildren.forEach((childId) => {
      const h = subtreeHeight(childId);
      place(childId, H_GAP, startY + h / 2, 'right');
      startY += h + V_GAP;
    });
  }

  // 放置左侧分支
  if (leftChildren.length === 1) {
    place(leftChildren[0], -H_GAP, 0, 'left');
  } else if (leftChildren.length > 1) {
    const totalH = leftChildren.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = -totalH / 2;
    leftChildren.forEach((childId) => {
      const h = subtreeHeight(childId);
      place(childId, -H_GAP, startY + h / 2, 'left');
      startY += h + V_GAP;
    });
  }

  return { posMap, sideMap };
}

/** tree-lr 布局 */
function layoutTreeLR(
  rootId: string,
  nodes: Node[],
  edges: Edge[],
): { posMap: Map<string, { x: number; y: number }>; sideMap: Map<string, NodeSide> } {
  const childrenMap = buildTree(nodes, edges);
  const posMap = new Map<string, { x: number; y: number }>();
  const sideMap = new Map<string, NodeSide>();
  const subtreeHeight = makeSubtreeHeight(childrenMap);
  const place = makePlaceSubtree(childrenMap, subtreeHeight, posMap, sideMap);
  place(rootId, 0, 0, 'right');
  return { posMap, sideMap };
}

/**
 * 主入口：计算布局，返回 posMap 和 sideMap。
 * rootOffset：根节点的实际画布坐标（保证根节点原地不动）。
 */
export function calculateLayout(
  nodes: Node[],
  edges: Edge[],
  rootId: string,
  style: LayoutStyle = 'mindmap',
  rootOffset: { x: number; y: number } = { x: 0, y: 0 },
): { posMap: Map<string, { x: number; y: number }>; sideMap: Map<string, NodeSide> } {
  const { posMap: rawMap, sideMap } =
    style === 'tree-lr'
      ? layoutTreeLR(rootId, nodes, edges)
      : layoutMindmap(rootId, nodes, edges);

  const posMap = new Map<string, { x: number; y: number }>();

  rawMap.forEach((pos, id) => {
    posMap.set(id, { x: pos.x + rootOffset.x, y: pos.y + rootOffset.y });
  });

  // 浮动节点保留原坐标
  nodes.forEach((n) => {
    if (!posMap.has(n.id)) {
      posMap.set(n.id, { x: n.position.x, y: n.position.y });
    }
  });

  return { posMap, sideMap };
}

/**
 * 将布局结果应用到节点数组，同时更新 data.side。
 */
export function applyLayout(
  nodes: Node[],
  posMap: Map<string, { x: number; y: number }>,
  sideMap?: Map<string, NodeSide>,
): Node[] {
  return nodes.map((n) => {
    const pos = posMap.get(n.id);
    const side = sideMap?.get(n.id);
    const posUpdate = pos ? { position: { x: pos.x, y: pos.y } } : {};
    const dataUpdate = side !== undefined ? { data: { ...n.data, side } } : {};
    return { ...n, ...posUpdate, ...dataUpdate };
  });
}

/** 找出离给定点最近的节点（排除自身），用于拖拽吸附检测 */
export function findNearestNode(
  nodes: Node[],
  dragNodeId: string,
  dragPosition: { x: number; y: number },
  threshold = 100,
): string | null {
  let nearestId: string | null = null;
  let minDist = threshold;

  nodes.forEach((n) => {
    if (n.id === dragNodeId) return;
    const dx = n.position.x - dragPosition.x;
    const dy = n.position.y - dragPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      nearestId = n.id;
    }
  });

  return nearestId;
}

/** 找到树的根节点 */
export function findRootId(nodes: Node[], edges: Edge[]): string {
  const rootNode = nodes.find((n) => n.data?.isRoot);
  if (rootNode) return rootNode.id;

  const hasParent = new Set(
    edges.filter((e) => e.type === 'hierarchyEdge' || !e.type).map((e) => e.target),
  );
  const candidate = nodes.find((n) => !hasParent.has(n.id));
  return candidate?.id ?? nodes[0]?.id ?? 'root';
}
