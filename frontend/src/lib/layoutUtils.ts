import type { Node, Edge } from '@xyflow/react';

export type LayoutStyle = 'mindmap' | 'tree-lr' | 'tree-tb';
export type NodeSide = 'left' | 'right';

const H_NODE_SPACING = 80; // 节点边缘到边缘的最小水平间距（右边缘→子左边缘 / 子右边缘→父左边缘）
const V_GAP = 70;          // 垂直节点间距
const NODE_H = 40;         // 默认高度（无 measured 时的回退值）
const NODE_W = 80;         // 默认宽度（无 measured 时的回退值）

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
 * - 无子节点  该节点实际测量高度（降级为 NODE_H）
 * - 1 个子节点  与父节点同 Y，高度 = max(自身高, 子树高)
 * - 多子节点  各子树高度之和 + 间距
 * heightMap: 每个节点的实际测量高度
 */
function makeSubtreeHeight(
  childrenMap: Map<string, string[]>,
  heightMap: Map<string, number>,
) {
  function subtreeHeight(nodeId: string): number {
    const selfH = heightMap.get(nodeId) ?? NODE_H;
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return selfH;
    if (children.length === 1) return Math.max(selfH, subtreeHeight(children[0]));
    const total = children.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    return Math.max(selfH, total);
  }
  return subtreeHeight;
}

/**
 * 递归放置子树，记录 sideMap（每个节点属于哪侧）
 *
 * ★ 坐标约定（统一，不可混用）：
 *   cy = 当前节点自身的 Y 轴中心（center Y），不是 top-left！
 *   cx = 当前节点自身的 X 轴左边缘（left X），对应 posMap 存储的 x。
 *   保存到 posMap 时转为 ReactFlow 要求的 top-left：y = cy - nodeH/2
 *
 * ★ 水平间距约定：
 *   子节点的左边缘 = 父节点右边缘 + H_NODE_SPACING（右向）
 *   子节点的右边缘 = 父节点左边缘 - H_NODE_SPACING（左向，right edge = cx - H_NODE_SPACING）
 *
 * 这样无论父/子节点宽度多少，节点间始终保持固定的视觉间隔，大内容节点不会与子节点重叠。
 */
function makePlaceSubtree(
  childrenMap: Map<string, string[]>,
  subtreeHeight: (id: string) => number,
  posMap: Map<string, { x: number; y: number }>,
  sideMap: Map<string, NodeSide>,
  heightMap: Map<string, number>,
  widthMap: Map<string, number>,
) {
  function place(nodeId: string, cx: number, cy: number, direction: NodeSide) {
    // cy = 节点中心 Y → 转为 top-left Y 存入 posMap；cx = 节点左边缘 X
    const nodeH = heightMap.get(nodeId) ?? NODE_H;
    const nodeW = widthMap.get(nodeId) ?? NODE_W;
    posMap.set(nodeId, { x: cx, y: cy - nodeH / 2 });
    sideMap.set(nodeId, direction);
    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return;

    if (children.length === 1) {
      // 单子节点：子节点中心 Y = 父节点中心 Y（水平连线对齐）
      const childId = children[0];
      const childW = widthMap.get(childId) ?? NODE_W;
      // 右向：子左边缘 = 父右边缘 + 间距；左向：子右边缘 = 父左边缘 - 间距
      const childCx = direction === 'right'
        ? cx + nodeW + H_NODE_SPACING
        : cx - H_NODE_SPACING - childW;
      place(childId, childCx, cy, direction);
      return;
    }

    // 多子节点：各子树垂直均匀分布，整组以父节点中心 Y（cy）为中轴
    const totalH = children.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = cy - totalH / 2; // 第一个子树区域的顶部 Y
    children.forEach((childId) => {
      const h = subtreeHeight(childId);
      const childW = widthMap.get(childId) ?? NODE_W;
      const childCx = direction === 'right'
        ? cx + nodeW + H_NODE_SPACING
        : cx - H_NODE_SPACING - childW;
      // 每个子树区域中心 = startY + h/2，传给子节点作为其中心 Y
      place(childId, childCx, startY + h / 2, direction);
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
/** 从 nodes 数组构建 节点实际高度映射（优先用 React Flow 的 measured.height） */
function buildHeightMap(nodes: Node[]): Map<string, number> {
  const m = new Map<string, number>();
  nodes.forEach((n) => {
    const h = (n.measured as { width?: number; height?: number } | undefined)?.height;
    m.set(n.id, typeof h === 'number' && h > 0 ? h : NODE_H);
  });
  return m;
}

/** 从 nodes 数组构建 节点实际宽度映射（优先用 React Flow 的 measured.width） */
function buildWidthMap(nodes: Node[]): Map<string, number> {
  const m = new Map<string, number>();
  nodes.forEach((n) => {
    const w = (n.measured as { width?: number; height?: number } | undefined)?.width;
    m.set(n.id, typeof w === 'number' && w > 0 ? w : NODE_W);
  });
  return m;
}

function layoutMindmap(
  rootId: string,
  nodes: Node[],
  edges: Edge[],
): { posMap: Map<string, { x: number; y: number }>; sideMap: Map<string, NodeSide> } {
  const childrenMap = buildTree(nodes, edges);
  const posMap = new Map<string, { x: number; y: number }>();
  const sideMap = new Map<string, NodeSide>();
  const heightMap = buildHeightMap(nodes);
  const widthMap = buildWidthMap(nodes);
  const subtreeHeight = makeSubtreeHeight(childrenMap, heightMap);
  const place = makePlaceSubtree(childrenMap, subtreeHeight, posMap, sideMap, heightMap, widthMap);

  // 根节点本身放在原点
  posMap.set(rootId, { x: 0, y: 0 });
  sideMap.set(rootId, 'right'); // 根节点 side 无意义，给个默认值

  const nodeDataMap = new Map(nodes.map((n) => [n.id, n.data]));
  const rootChildren = childrenMap.get(rootId) ?? [];
  const rootH = heightMap.get(rootId) ?? NODE_H;
  const rootW = widthMap.get(rootId) ?? NODE_W;

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
      // 没有 side：按奇偶分配（第 0、2、4... 个 → 右，第 1、3、5... 个 → 左）
      if (unassignedIdx % 2 === 0) {
        rightChildren.push(childId);
      } else {
        leftChildren.push(childId);
      }
      unassignedIdx++;
    }
  });

  // ★ place() 约定：cy = 节点中心 Y，cx = 节点左边缘 X。
  // 根节点 top-left=(0,0)，根节点中心 Y = rootH/2。
  // 所有子节点以 rootH/2 为基准对齐。
  // 右向子节点的左边缘 = 根节点右边缘 + H_NODE_SPACING
  // 左向子节点的右边缘 = 根节点左边缘(0) - H_NODE_SPACING → 子节点左边缘 = -H_NODE_SPACING - childW

  // 放置右侧分支
  if (rightChildren.length === 1) {
    // 单子节点中心 Y = 根节点中心 Y
    place(rightChildren[0], rootW + H_NODE_SPACING, rootH / 2, 'right');
  } else if (rightChildren.length > 1) {
    const totalH = rightChildren.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = rootH / 2 - totalH / 2; // 第一个子树区域顶部
    rightChildren.forEach((childId) => {
      const h = subtreeHeight(childId);
      place(childId, rootW + H_NODE_SPACING, startY + h / 2, 'right'); // 子树区域中心 = 节点中心
      startY += h + V_GAP;
    });
  }

  // 放置左侧分支（子节点右边缘 = 根节点左边缘 - H_NODE_SPACING）
  if (leftChildren.length === 1) {
    const childW = widthMap.get(leftChildren[0]) ?? NODE_W;
    place(leftChildren[0], -H_NODE_SPACING - childW, rootH / 2, 'left');
  } else if (leftChildren.length > 1) {
    const totalH = leftChildren.reduce((s, c) => s + subtreeHeight(c) + V_GAP, 0) - V_GAP;
    let startY = rootH / 2 - totalH / 2;
    leftChildren.forEach((childId) => {
      const h = subtreeHeight(childId);
      const childW = widthMap.get(childId) ?? NODE_W;
      place(childId, -H_NODE_SPACING - childW, startY + h / 2, 'left');
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
  const heightMap = buildHeightMap(nodes);
  const widthMap = buildWidthMap(nodes);
  const subtreeHeight = makeSubtreeHeight(childrenMap, heightMap);
  const place = makePlaceSubtree(childrenMap, subtreeHeight, posMap, sideMap, heightMap, widthMap);
  // tree-lr：根节点 top-left=(0,0)，中心 Y = rootH/2
  const rootH = heightMap.get(rootId) ?? NODE_H;
  place(rootId, 0, rootH / 2, 'right');
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

/**
 * 基于包围盒碰撞检测，找出与被拖拽节点真实接触（边框重叠）的目标节点（排除自身）。
 * 动态读取节点的 measured 宽高，兼容编辑后尺寸变化的节点。
 * 类似游戏碰撞逻辑：接触立即触发，脱离立即取消。
 */
export function findCollidingNode(
  nodes: Node[],
  dragNodeId: string,
  draggedNode: Node,
): string | null {
  const dw = (draggedNode.measured as { width?: number } | undefined)?.width ?? 80;
  const dh = (draggedNode.measured as { height?: number } | undefined)?.height ?? 40;
  const dx1 = draggedNode.position.x;
  const dy1 = draggedNode.position.y;
  const dx2 = dx1 + dw;
  const dy2 = dy1 + dh;

  for (const n of nodes) {
    if (n.id === dragNodeId || n.hidden) continue;
    const nw = (n.measured as { width?: number } | undefined)?.width ?? 80;
    const nh = (n.measured as { height?: number } | undefined)?.height ?? 40;
    const nx1 = n.position.x;
    const ny1 = n.position.y;
    const nx2 = nx1 + nw;
    const ny2 = ny1 + nh;

    // 包围盒重叠：两个矩形的边框相交即触发
    if (dx1 < nx2 && dx2 > nx1 && dy1 < ny2 && dy2 > ny1) {
      return n.id;
    }
  }

  return null;
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
