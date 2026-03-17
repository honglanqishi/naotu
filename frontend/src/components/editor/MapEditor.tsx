'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ReactFlow,
    addEdge,
    useNodesState,
    useEdgesState,
    MiniMap,
    Background,
    BackgroundVariant,
    SelectionMode,
    type Connection,
    type Node,
    type Edge,
    type NodeChange,
    useReactFlow,
    ReactFlowProvider,
    type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { MindNode, type NodeDecoration, type MindNodeData } from '@/components/editor/nodes/MindNode';
import { HierarchyEdge } from '@/components/editor/edges/HierarchyEdge';
import { AssociationEdge } from '@/components/editor/edges/AssociationEdge';
import { ContextMenu, type ContextMenuAction } from '@/components/editor/ContextMenu';
import {
    calculateLayout,
    applyLayout,
    findCollidingNode,
    findRootId,
    type LayoutStyle,
} from '@/lib/layoutUtils';

// 自定义节点 & 边类型（必须定义在组件外，避免每次渲染重新创建）
const nodeTypes = { mindNode: MindNode } as const;
const edgeTypes = {
    hierarchyEdge: HierarchyEdge,
    associationEdge: AssociationEdge,
} as const;

/** 稳定的空集合，无折叠节点时直接复用，避免每帧创建新 Set */
const EMPTY_ID_SET = new Set<string>();

interface MindMap {
    id: string;
    title: string;
    nodes: Node[];
    edges: Edge[];
    viewport: { x: number; y: number; zoom: number };
}

interface ContextMenuState {
    x: number;
    y: number;
    /** undefined = 空白画布右键; 否则为节点 ID */
    nodeId?: string;
}

/** 装饰编辑弹窗状态 */
interface DecorationEditState {
    nodeId: string;
    type: keyof NodeDecoration;
}

// ─── 全局唯一 ID 生成器（UUIDv4，彻底避免多端/快速操作导致的 ID 碰撞） ────────
function genId(prefix: string) {
    // crypto.randomUUID() 在浏览器原生可用，无需额外依赖
    return `${prefix}-${crypto.randomUUID()}`;
}

// ─── 递归收集子孙节点 ID ───────────────────────────────────────────────────────
function collectDescendants(nodeId: string, edges: Edge[]): string[] {
    const children = edges
        .filter((e) => e.source === nodeId && (e.type === 'hierarchyEdge' || !e.type))
        .map((e) => e.target);
    return [...children, ...children.flatMap((c) => collectDescendants(c, edges))];
}

// ─── 根据折叠状态计算需要隐藏的节点 ID 集合 ──────────────────────────────────
function getHiddenNodeIds(nodes: Node[], edges: Edge[]): Set<string> {
    const hidden = new Set<string>();
    nodes.forEach((node) => {
        if (node.data?.collapsed) {
            collectDescendants(node.id, edges).forEach((id) => hidden.add(id));
        }
    });
    return hidden;
}

// 自动保存防抖 Hook（1.5s，含 viewport）
function useAutoSave(
    mapId: string,
    nodes: Node[],
    edges: Edge[],
    ready: boolean,
    getViewport: () => Viewport,
) {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const queryClient = useQueryClient();

    const saveMutation = useMutation({
        mutationFn: async () => {
            await api.put(`/api/maps/${mapId}`, { nodes, edges, viewport: getViewport() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['map', mapId] });
        },
        onError: () => toast.error('自动保存失败'),
    });

    useEffect(() => {
        if (!ready) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => saveMutation.mutate(), 1500);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [nodes, edges, ready]); // eslint-disable-line

    return saveMutation.isPending;
}

// 内部编辑器（需要 useReactFlow，必须在 ReactFlowProvider 内）
function MapEditorInner({ mapId }: { mapId: string }) {
    const router = useRouter();
    const { screenToFlowPosition, fitView, getViewport, zoomIn, zoomOut } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const initializedRef = useRef(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('mindmap');
    /** 当前激活工具 */
    const [activeTool, setActiveTool] = useState<'select' | 'addNode' | 'connect'>('select');
    /** 当前缩放百分比（用于底栏显示） */
    const [zoomLevel, setZoomLevel] = useState(100);
    /** 节点剪贴板：存储 Ctrl+C 复制的节点，用于 Ctrl+V 粘贴 */
    const [clipboard, setClipboard] = useState<Node[]>([]);
    /** clipboard 的 ref 版本，供 keydown handler 读取（避免 stale closure + updater 内 preventDefault 问题） */
    const clipboardRef = useRef<Node[]>([]);
    clipboardRef.current = clipboard;
    /** 下钻导航栈（存储下钻路径上的节点 ID） */
    const [drillStack, setDrillStack] = useState<string[]>([]);
    /** 装饰编辑弹窗状态 */
    const [decoEdit, setDecoEdit] = useState<DecorationEditState | null>(null);
    /** 移动端布局开关 */
    const [isMobileLayout, setIsMobileLayout] = useState(false);
    /** 移动端属性面板是否展开 */
    const [isMobilePropsOpen, setIsMobilePropsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropTargetRef = useRef<string | null>(null);
    // 追踪节点是否正在被拖拽，拖拽期间禁止 dimensions 触发 reLayout
    const isDraggingRef = useRef(false);
    // 用于 onNodesChange dimensions 去抖重布局（防止每帧 resize 事件都触发）
    const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // 追踪右键是否发生拖拽（平移），避免平移后弹出右键菜单
    const rightDragRef = useRef({ startX: 0, startY: 0, moved: false });
    // 用 ref 持有最新 nodes/edges，供键盘 handler 使用，避免 useEffect 频繁重新注册
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    // ─── Undo / Redo 历史栈（不用 state，避免无效渲染） ──────────────────────
    type Snapshot = { nodes: Node[]; edges: Edge[] };
    const historyRef = useRef<Snapshot[]>([]);
    const futureRef = useRef<Snapshot[]>([]);

    /** 在执行任意变更操作前调用，把当前状态存入历史（浅拷贝数组，防止引用共享导致快照被后续操作静默污染） */
    const pushHistory = useCallback(() => {
        historyRef.current.push({ nodes: [...nodesRef.current], edges: [...edgesRef.current] });
        if (historyRef.current.length > 50) historyRef.current.shift();
        futureRef.current = []; // 新操作清空 redo 栈
    }, []);

    const undo = useCallback(() => {
        const prev = historyRef.current.pop();
        if (!prev) { toast.info('没有可撤销的操作'); return; }
        futureRef.current.push({ nodes: [...nodesRef.current], edges: [...edgesRef.current] });
        setNodes(prev.nodes);
        setEdges(prev.edges);
    }, [setNodes, setEdges]);

    const redo = useCallback(() => {
        const next = futureRef.current.pop();
        if (!next) { toast.info('没有可重做的操作'); return; }
        historyRef.current.push({ nodes: [...nodesRef.current], edges: [...edgesRef.current] });
        setNodes(next.nodes);
        setEdges(next.edges);
    }, [setNodes, setEdges]);

    // 数据加载
    const { data: map, isLoading } = useQuery({
        queryKey: ['map', mapId],
        queryFn: async () => {
            const res = await api.get<{ map: MindMap }>(`/api/maps/${mapId}`);
            return res.data.map;
        },
    });

    // 初始化节点（只执行一次）
    useEffect(() => {
        if (map && !initializedRef.current) {
            setNodes(map.nodes || []);
            setEdges(map.edges || []);
            initializedRef.current = true;

            // 若是新图（viewport 从未保存/为默认值），自动 fitView 居中根节点
            const vp = map.viewport;
            const isDefaultViewport = !vp || (vp.x === 0 && vp.y === 0 && vp.zoom === 1);
            if (isDefaultViewport && map.nodes && map.nodes.length > 0) {
                setTimeout(() => fitView({ padding: 0.4, duration: 400 }), 80);
            }
        }
    }, [map, setNodes, setEdges, fitView]);

    // 监听视口，切换移动端布局（SSR 安全）
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(max-width: 1024px)');
        const sync = () => setIsMobileLayout(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

    // 自动保存（含 viewport）
    const isSaving = useAutoSave(mapId, nodes, edges, initializedRef.current, getViewport);

    // ─── 右侧面板：当前选中节点 ──────────────────────────────────────────────
    const selectedNode = nodes.find((n) => n.selected) ?? null;

    // 移动端选中节点后自动展开属性面板，提升编辑可达性
    useEffect(() => {
        if (!isMobileLayout) return;
        if (selectedNode) setIsMobilePropsOpen(true);
    }, [isMobileLayout, selectedNode]);

    /** 删除选中节点（含子孙） */
    const deleteSelectedNode = useCallback(() => {
        if (!selectedNode || selectedNode.data?.isRoot) return;
        pushHistory();
        const descendants = collectDescendants(selectedNode.id, edgesRef.current);
        const toDelete = new Set([selectedNode.id, ...descendants]);
        const nextNodes = nodesRef.current.filter((n) => !toDelete.has(n.id));
        const nextEdges = edgesRef.current.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
        setEdges(nextEdges);
        setNodes(reLayout(nextNodes, nextEdges));
    }, [selectedNode, pushHistory, setNodes, setEdges]); // eslint-disable-line

    /** 修改选中节点的 label */
    const updateSelectedNodeLabel = useCallback((label: string) => {
        if (!selectedNode) return;
        setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n));
    }, [selectedNode, setNodes]);

    // 布局重算工具函数：保持根节点实际位置不变
    const reLayout = useCallback(
        (currentNodes: Node[], currentEdges: Edge[]) => {
            const rootId = findRootId(currentNodes, currentEdges);
            const rootNode = currentNodes.find((n) => n.id === rootId);
            const rootOffset = rootNode?.position ?? { x: 0, y: 0 };
            const { posMap, sideMap } = calculateLayout(currentNodes, currentEdges, rootId, layoutStyle, rootOffset);
            return applyLayout(currentNodes, posMap, sideMap);
        },
        [layoutStyle],
    );

    // 连线处理：统一创建层级线
    const onConnect = useCallback(
        (connection: Connection) => {
            pushHistory();
            const newEdge: Edge = {
                ...connection,
                id: genId('edge'),
                type: 'hierarchyEdge',
            };
            const nextEdges = addEdge(newEdge, edges);
            setEdges(nextEdges);
            setNodes((nds) => reLayout(nds, nextEdges));
        },
        [edges, setEdges, setNodes, reLayout, pushHistory],
    );

    // 在画布指定位置新建节点
    const createNode = useCallback(
        (flowPosition: { x: number; y: number }, label = '主题'): Node => ({
            id: genId('node'),
            type: 'mindNode',
            position: flowPosition,
            data: { label },
        }),
        [],
    );

    // 双击画布新建浮动主题（在外层 div 上处理，检测点击目标是否为画布背景）
    const onCanvasDoubleClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            // 用 closest 向上查找，排除点击在节点/控件/菜单上的双击
            const target = e.target as HTMLElement;
            const isPane = !!target.closest('.react-flow__pane');
            const isOnNode = !!target.closest('.react-flow__node');
            const isOnControls = !!target.closest('.react-flow__controls');
            if (!isPane || isOnNode || isOnControls) return;
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            setNodes((nds) => [...nds, createNode(flowPos, '主题')]);
        },
        [screenToFlowPosition, createNode, setNodes],
    );

    // 拖拽开始：标记拖拽状态，避免 dimensions 变化触发 reLayout 导致节点位置闪烁
    const onNodeDragStart = useCallback(() => {
        isDraggingRef.current = true;
    }, []);

    // 拖拽过程：基于包围盒碰撞检测吸附目标（动态读取 measured 尺寸，触碰即触发）
    const onNodeDrag = useCallback(
        (_e: React.MouseEvent, draggedNode: Node) => {
            const nearest = findCollidingNode(nodesRef.current, draggedNode.id, draggedNode);

            if (nearest !== dropTargetRef.current) {
                const prevTarget = dropTargetRef.current;
                dropTargetRef.current = nearest;

                // 单次 setNodes 合并新旧 isDropTarget 变更，避免两次 setState 导致 ReactFlow 中间态渲染
                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === prevTarget && prevTarget !== nearest)
                            return { ...n, data: { ...n.data, isDropTarget: false } };
                        if (n.id === nearest)
                            return { ...n, data: { ...n.data, isDropTarget: true } };
                        return n;
                    }),
                );
            }
        },
        [setNodes], // 不依赖 nodes，通过 nodesRef.current 读取
    );

    // 拖拽结束：若有吸附目标，建立父子关系并重新布局（通过 ref 读取最新 edges）
    const onNodeDragStop = useCallback(
        (_e: React.MouseEvent, draggedNode: Node) => {
            // 先恢复拖拽标记，再执行清理与布局
            isDraggingRef.current = false;
            const targetId = dropTargetRef.current;

            setNodes((nds) =>
                nds.map((n) =>
                    n.data?.isDropTarget ? { ...n, data: { ...n.data, isDropTarget: false } } : n,
                ),
            );
            dropTargetRef.current = null;

            if (!targetId) return;

            const alreadyConnected = edgesRef.current.some(
                (e) => e.type === 'hierarchyEdge' && e.source === targetId && e.target === draggedNode.id,
            );
            if (alreadyConnected) return;

            pushHistory();
            const newEdge: Edge = {
                id: genId('edge'),
                source: targetId,
                target: draggedNode.id,
                type: 'hierarchyEdge',
            };

            // 移除被拖拽节点的旧父子层级边，再挂到新父节点下，避免出现三角/多父关系
            const filteredEdges = edgesRef.current.filter(
                (e) => !(e.type === 'hierarchyEdge' && e.target === draggedNode.id),
            );
            const nextEdges = [...filteredEdges, newEdge];
            setEdges(nextEdges);
            setNodes((nds) => reLayout(nds, nextEdges));
        },
        [setEdges, setNodes, reLayout, pushHistory], // 不依赖 edges，通过 edgesRef.current 读取
    );

    // 键盘事件：Tab 新增子节点 / Delete 删除选中节点
    // 通过 ref 读取最新 nodes/edges，useEffect 只注册一次，避免每帧重新绑定
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;

            // ── Ctrl+Z：撤销 ────────────────────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // ── Ctrl+Shift+Z / Ctrl+Y：重做 ─────────────────────────────
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
                return;
            }

            // ── Ctrl+C：复制选中节点到剪贴板 ────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                const selected = nodes.filter((n) => n.selected);
                if (selected.length === 0) return;
                setClipboard(selected);
                toast.success(`已复制 ${selected.length} 个节点`);
                return;
            }

            // ── Ctrl+V：粘贴剪贴板中的节点 ──────────────────────────────
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                // 如果焦点在输入框里，让输入框自己处理粘贴
                if (
                    document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement ||
                    (document.activeElement as HTMLElement)?.isContentEditable
                ) return;
                // 通过 clipboardRef 读取最新剪贴板，避免在 state updater 内调用 e.preventDefault()（在 StrictMode 双调用下不安全）
                const cb = clipboardRef.current;
                if (cb.length === 0) return;
                e.preventDefault();
                pushHistory();
                const offset = 40;
                const newNodes = cb.map((n) => ({
                    ...n,
                    id: genId('node'),
                    position: { x: n.position.x + offset, y: n.position.y + offset },
                    data: { ...n.data, isRoot: false },
                    selected: true,
                }));
                setNodes((nds) => [
                    ...nds.map((n) => ({ ...n, selected: false })),
                    ...newNodes,
                ]);
                return;
            }

            // ── Tab：新增子节点 ──────────────────────────────────────────
            if (e.key === 'Tab') {
                // 焦点在输入框 / 富文本编辑区时，交给编辑区自己处理（缩进等）
                if (
                    document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement ||
                    (document.activeElement as HTMLElement)?.isContentEditable
                ) return;
                // 无论是否有选中节点，都先阻止默认行为，防止焦点逃到工具栏按钮
                e.preventDefault();
                const selectedNode = nodes.find((n) => n.selected);
                if (!selectedNode) return;

                pushHistory();
                const childNode: Node = {
                    id: genId('node'),
                    type: 'mindNode',
                    position: { x: selectedNode.position.x + 200, y: selectedNode.position.y },
                    data: { label: '子主题', side: 'right' },
                };
                const newEdge: Edge = {
                    id: genId('edge'),
                    source: selectedNode.id,
                    target: childNode.id,
                    type: 'hierarchyEdge',
                };

                const nextEdges = [...edges, newEdge];
                const nextNodes = reLayout([...nodes, childNode], nextEdges);
                setEdges(nextEdges);
                setNodes(nextNodes);
                return;
            }

            // ── Delete / Backspace：删除选中节点（跳过根节点和编辑中的输入框/富文本框） ──
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // 如果焦点在输入框或富文本编辑区里，让编辑区自己处理，不触发节点删除
                if (
                    document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement ||
                    (document.activeElement as HTMLElement)?.isContentEditable
                ) return;

                const selectedNodes = nodes.filter((n) => n.selected && !n.data?.isRoot);
                if (selectedNodes.length === 0) return;
                e.preventDefault();

                pushHistory();
                // 收集所有要删除的节点（含子孙）
                const toDelete = new Set<string>();
                selectedNodes.forEach((n) => {
                    toDelete.add(n.id);
                    collectDescendants(n.id, edges).forEach((id) => toDelete.add(id));
                });

                const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
                const nextEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
                setEdges(nextEdges);
                setNodes(reLayout(nextNodes, nextEdges));
            }
        };

        // 使用 document + capture 阶段，确保 Tab 键在焦点移动前被拦截，
        // 即使焦点在 NodeToolbar portal（可能在 containerRef DOM 子树之外）的按钮上也能正常工作
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reLayout, setNodes, setEdges, undo, redo, pushHistory, setClipboard]); // 不依赖 nodes/edges，通过 ref 读取最新值

    // 组件卸载时清理 layout 防抖定时器，防止在已卸载组件上调用 setNodes 触发 React 警告
    useEffect(() => {
        return () => {
            if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
        };
    }, []);

    // ─── 监听 ReactFlow 节点尺寸变化事件，精确触发重新布局 ─────────────────────────
    // ReactFlow 在测量到节点真实 DOM 尺寸后，会通过 onNodesChange 发出 type='dimensions' 变更。
    // 这是最可靠的时机：此时 node.measured 已经是最新值，布局计算不会因为用旧尺寸而出错。
    // 用去抖（50ms）合并同一帧内多个节点同时尺寸变化的情况。
    const onNodesChangeWithLayout = useCallback(
        (changes: NodeChange[]) => {
            onNodesChange(changes);
            // 拖拽期间禁止 dimensions 触发重布局，否则会把拖拽节点强制 snap 回布局位置
            if (isDraggingRef.current) return;
            // 仅当有节点尺寸真实变化时才触发重布局（排除拖拽时的 position 变更）
            const hasDimension = changes.some((c) => c.type === 'dimensions');
            if (!hasDimension) return;
            if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
            layoutDebounceRef.current = setTimeout(() => {
                setNodes((nds) => reLayout(nds, edgesRef.current));
            }, 50);
        },
        [onNodesChange, setNodes, reLayout],
    );

    // ─── 在 document 上监听 mousemove，确保不丢失移动事件（比 div onMouseMove 更可靠） ──
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (e.buttons !== 2) return;
            const dx = e.clientX - rightDragRef.current.startX;
            const dy = e.clientY - rightDragRef.current.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                rightDragRef.current.moved = true;
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // ─── 用原生事件监听 mousedown，确保在 ReactFlow 可能的 stopPropagation 之前捕获 ──
    // React synthetic event 的 stopPropagation 不会阻止原生 document 监听器
    useEffect(() => {
        const handleNativeMouseDown = (e: MouseEvent) => {
            if (e.button === 2) {
                rightDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
            }
        };
        const container = containerRef.current;
        container?.addEventListener('mousedown', handleNativeMouseDown);
        return () => container?.removeEventListener('mousedown', handleNativeMouseDown);
    }, []);

    // 右键菜单：禁用浏览器默认菜单
    const onContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        // 双重验证：moved 标志 OR 实际偏移距离 > 3px，只要满足任一条件就认定为拖拽平移，不弹菜单
        const dx = e.clientX - rightDragRef.current.startX;
        const dy = e.clientY - rightDragRef.current.startY;
        if (rightDragRef.current.moved || Math.sqrt(dx * dx + dy * dy) > 3) {
            return;
        }
        const nodeEl = (e.target as HTMLElement).closest('[data-id]');
        const nodeId = nodeEl?.getAttribute('data-id') ?? undefined;
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    }, []);

    const onPaneClick = useCallback(() => setContextMenu(null), []);

    // ─── 下钻逻辑 ────────────────────────────────────────────────────────────
    const drillDown = useCallback(
        (nodeId: string) => {
            setDrillStack((stack) => [...stack, nodeId]);
            // 标记下钻根节点
            setNodes((nds) =>
                nds.map((n) => ({
                    ...n,
                    data: { ...n.data, isDrillRoot: n.id === nodeId ? true : undefined },
                })),
            );
            setTimeout(() => fitView({ padding: 0.4, duration: 400 }), 100);
        },
        [setNodes, fitView],
    );

    const drillUp = useCallback(() => {
        setDrillStack((stack) => {
            const newStack = stack.slice(0, -1);
            const parentDrillId = newStack.length > 0 ? newStack[newStack.length - 1] : null;
            // 更新 isDrillRoot 标记
            setNodes((nds) =>
                nds.map((n) => ({
                    ...n,
                    data: {
                        ...n.data,
                        isDrillRoot: parentDrillId && n.id === parentDrillId ? true : undefined,
                    },
                })),
            );
            setTimeout(() => fitView({ padding: 0.4, duration: 400 }), 100);
            return newStack;
        });
    }, [setNodes, fitView]);

    // 监听 MindNode 的自定义事件
    useEffect(() => {
        const handleDrillUp = () => drillUp();
        const handleEditDecoration = (e: Event) => {
            const detail = (e as CustomEvent).detail as { nodeId: string; decorationType: keyof NodeDecoration };
            setDecoEdit({ nodeId: detail.nodeId, type: detail.decorationType });
        };
        window.addEventListener('mindmap-drill-up', handleDrillUp);
        window.addEventListener('mindmap-edit-decoration', handleEditDecoration);
        return () => {
            window.removeEventListener('mindmap-drill-up', handleDrillUp);
            window.removeEventListener('mindmap-edit-decoration', handleEditDecoration);
        };
    }, [drillUp]);

    // ─── 装饰操作辅助函数 ─────────────────────────────────────────────────────
    const updateDecoration = useCallback(
        (nodeId: string, key: keyof NodeDecoration, value: unknown) => {
            pushHistory();
            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id !== nodeId) return n;
                    const prev = (n.data?.decorations ?? {}) as NodeDecoration;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            decorations: { ...prev, [key]: value },
                        },
                    };
                }),
            );
        },
        [setNodes, pushHistory],
    );

    const removeDecoration = useCallback(
        (nodeId: string, key: keyof NodeDecoration) => {
            pushHistory();
            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id !== nodeId) return n;
                    const prev = { ...((n.data?.decorations ?? {}) as NodeDecoration) };
                    delete prev[key];
                    const hasAny = Object.keys(prev).length > 0;
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            decorations: hasAny ? prev : undefined,
                        },
                    };
                }),
            );
        },
        [setNodes, pushHistory],
    );

    /** 修改选中节点的主题色（存入 decorations.highlight） */
    const updateSelectedNodeColor = useCallback((color: string) => {
        if (!selectedNode) return;
        updateDecoration(selectedNode.id, 'highlight', color);
    }, [selectedNode, updateDecoration]);

    // 构建右键菜单 actions
    const buildContextMenuActions = useCallback((): ContextMenuAction[] => {
        if (!contextMenu) return [];

        const flowPos = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y });

        if (contextMenu.nodeId) {
            const targetNodeId = contextMenu.nodeId;
            const targetNode = nodes.find((n) => n.id === targetNodeId);
            const isRoot = !!targetNode?.data?.isRoot;

            const addChildAction: ContextMenuAction = {
                label: '添加子节点',
                icon: <PlusIcon />,
                onClick: () => {
                    pushHistory();
                    const parent = nodes.find((n) => n.id === targetNodeId);
                    const childNode: Node = {
                        id: genId('node'),
                        type: 'mindNode',
                        position: { x: (parent?.position.x ?? 0) + 200, y: parent?.position.y ?? 0 },
                        data: { label: '子主题', side: 'right' },
                    };
                    const newEdge: Edge = {
                        id: genId('edge'),
                        source: targetNodeId,
                        target: childNode.id,
                        type: 'hierarchyEdge',
                    };
                    const nextEdges = [...edges, newEdge];
                    const nextNodes = reLayout([...nodes, childNode], nextEdges);
                    setEdges(nextEdges);
                    setNodes(nextNodes);
                },
                dividerAfter: true,
            };

            const copyAction: ContextMenuAction = {
                label: '复制',
                icon: <CopyIcon />,
                shortcut: 'Ctrl+C',
                onClick: () => {
                    const original = nodes.find((n) => n.id === targetNodeId);
                    if (!original) return;
                    setClipboard([original]);
                    toast.success('已复制节点');
                },
            };

            const pasteNodeAction: ContextMenuAction = {
                label: '粘贴',
                icon: <PasteIcon />,
                shortcut: 'Ctrl+V',
                disabled: clipboard.length === 0,
                onClick: () => {
                    if (clipboard.length === 0) return;
                    pushHistory();
                    const offset = 40;
                    const newNodes = clipboard.map((n) => ({
                        ...n,
                        id: genId('node'),
                        position: { x: n.position.x + offset, y: n.position.y + offset },
                        data: { ...n.data, isRoot: false },
                        selected: true,
                    }));
                    setNodes((nds) => [
                        ...nds.map((n) => ({ ...n, selected: false })),
                        ...newNodes,
                    ]);
                },
                dividerAfter: true,
            };

            const newNodeAction: ContextMenuAction = {
                label: '新建节点',
                icon: <AddIcon />,
                onClick: () => {
                    pushHistory();
                    setNodes((nds) => [...nds, createNode(flowPos)]);
                },
            };

            // 撤销/重做选项（除了删除节点内部已 pushHistory）
            const nodeUndoAction: ContextMenuAction = {
                label: historyRef.current.length > 0 ? `撤销 (${historyRef.current.length})` : '撤销',
                icon: <UndoIcon />,
                shortcut: 'Ctrl+Z',
                onClick: undo,
            };
            const nodeRedoAction: ContextMenuAction = {
                label: futureRef.current.length > 0 ? `重做 (${futureRef.current.length})` : '重做',
                icon: <RedoIcon />,
                shortcut: 'Ctrl+Y',
                onClick: redo,
                dividerAfter: true,
            };

            // ── "添加" 子菜单（节点装饰） ───────────────────────────────
            const addDecorationSubmenu: ContextMenuAction = {
                label: '添加',
                icon: <PlusCircleIcon />,
                children: [
                    {
                        label: '评论',
                        icon: <span style={{ fontSize: 13 }}>💬</span>,
                        onClick: () => {
                            const node = nodes.find(n => n.id === targetNodeId);
                            const current = (node?.data as MindNodeData | undefined)?.decorations?.comment;
                            if (!current || current.length === 0) {
                                updateDecoration(targetNodeId, 'comment', []);
                            }
                            setTimeout(() => window.dispatchEvent(new CustomEvent('mindmap-edit-decoration', { detail: { nodeId: targetNodeId, decorationType: 'comment' } })), 50);
                        },
                    },
                    {
                        label: '注释',
                        icon: <span style={{ fontSize: 13 }}>📝</span>,
                        onClick: () => {
                            const node = nodes.find(n => n.id === targetNodeId);
                            const current = (node?.data as MindNodeData | undefined)?.decorations?.note;
                            if (current === undefined || current === null) {
                                updateDecoration(targetNodeId, 'note', '');
                            }
                            setTimeout(() => window.dispatchEvent(new CustomEvent('mindmap-edit-decoration', { detail: { nodeId: targetNodeId, decorationType: 'note' } })), 50);
                        },
                    },
                    {
                        label: '图标',
                        icon: <span style={{ fontSize: 13 }}>🎯</span>,
                        onClick: () => {
                            const icons = ['⭐', '❤️', '🔥', '✅', '⚠️', '❌', '💡', '🎯', '🚀', '📌'];
                            const pick = window.prompt(`选择图标（输入序号 1-${icons.length}）：\n${icons.map((ic, i) => `${i + 1}. ${ic}`).join('  ')}`);
                            if (pick) {
                                const idx = parseInt(pick) - 1;
                                if (idx >= 0 && idx < icons.length) updateDecoration(targetNodeId, 'icon', icons[idx]);
                            }
                        },
                    },
                    {
                        label: '标签',
                        icon: <span style={{ fontSize: 13 }}>🏷️</span>,
                        onClick: () => {
                            const node = nodes.find(n => n.id === targetNodeId);
                            const current = (node?.data as MindNodeData | undefined)?.decorations?.tags;
                            if (!current || current.length === 0) {
                                updateDecoration(targetNodeId, 'tags', []);
                            }
                            setTimeout(() => window.dispatchEvent(new CustomEvent('mindmap-edit-decoration', { detail: { nodeId: targetNodeId, decorationType: 'tags' } })), 50);
                        },
                    },
                    {
                        label: '添加任务',
                        icon: <span style={{ fontSize: 13 }}>📋</span>,
                        onClick: () => {
                            const title = window.prompt('输入任务标题：');
                            if (title) updateDecoration(targetNodeId, 'task', { title, status: 'todo' });
                        },
                    },
                    {
                        label: '待办',
                        icon: <span style={{ fontSize: 13 }}>☑️</span>,
                        onClick: () => {
                            updateDecoration(targetNodeId, 'todo', { checked: false });
                        },
                    },
                    {
                        label: '超链接',
                        icon: <span style={{ fontSize: 13 }}>🔗</span>,
                        onClick: () => {
                            const node = nodes.find((n) => n.id === targetNodeId);
                            const current = (node?.data as MindNodeData | undefined)?.decorations?.hyperlink;
                            if (!current) {
                                updateDecoration(targetNodeId, 'hyperlink', { url: '' });
                            }
                            setTimeout(
                                () =>
                                    window.dispatchEvent(
                                        new CustomEvent('mindmap-edit-decoration', {
                                            detail: { nodeId: targetNodeId, decorationType: 'hyperlink' },
                                        }),
                                    ),
                                50,
                            );
                        },
                    },
                    {
                        label: '节点高亮',
                        icon: <span style={{ fontSize: 13 }}>✨</span>,
                        children: [
                            { label: '🔴 红色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#ef4444') },
                            { label: '🟠 橙色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#f97316') },
                            { label: '🟡 黄色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#eab308') },
                            { label: '🟢 绿色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#22c55e') },
                            { label: '🔵 蓝色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#3b82f6') },
                            { label: '🟣 紫色', onClick: () => updateDecoration(targetNodeId, 'highlight', '#a855f7') },
                            { label: '❌ 清除高亮', danger: true, onClick: () => removeDecoration(targetNodeId, 'highlight') },
                        ],
                    },
                ],
                dividerAfter: true,
            };

            // ── 下钻（始终显示，即使没有子节点） ──────────────────────────────────
            const drillDownAction: ContextMenuAction = {
                label: '下钻',
                icon: <DrillDownIcon />,
                onClick: () => drillDown(targetNodeId),
                dividerAfter: true,
            };

            // 根节点不显示删除选项
            if (isRoot) {
                const actions = [nodeUndoAction, nodeRedoAction, addChildAction, addDecorationSubmenu];
                actions.push(drillDownAction);
                actions.push(copyAction, pasteNodeAction, newNodeAction);
                return actions;
            }

            // 检测是否处于多选批量删除模式：右键点击的节点已被选中，且有其他节点也被选中
            const selectedNonRootNodes = nodes.filter((n) => n.selected && !n.data?.isRoot);
            const isBatchMode = !!targetNode?.selected && selectedNonRootNodes.length > 1;

            if (isBatchMode) {
                // 批量删除：删除所有选中节点（含各自子孙）
                const batchDeleteAction: ContextMenuAction = {
                    label: `删除选中节点 (${selectedNonRootNodes.length})`,
                    icon: <TrashIcon />,
                    danger: true,
                    onClick: () => {
                        pushHistory();
                        const toDelete = new Set<string>();
                        selectedNonRootNodes.forEach((n) => {
                            toDelete.add(n.id);
                            collectDescendants(n.id, edges).forEach((id) => toDelete.add(id));
                        });
                        const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
                        const nextEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
                        setEdges(nextEdges);
                        setNodes(reLayout(nextNodes, nextEdges));
                    },
                };
                const actions = [nodeUndoAction, nodeRedoAction, addChildAction, addDecorationSubmenu];
                actions.push(drillDownAction);
                actions.push(copyAction, pasteNodeAction, newNodeAction, batchDeleteAction);
                return actions;
            }

            const deleteAction: ContextMenuAction = {
                label: '删除节点（含子节点）',
                icon: <TrashIcon />,
                danger: true,
                onClick: () => {
                    pushHistory();
                    const descendants = collectDescendants(targetNodeId, edges);
                    const toDelete = new Set([targetNodeId, ...descendants]);
                    const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
                    const nextEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
                    setEdges(nextEdges);
                    setNodes(reLayout(nextNodes, nextEdges));
                },
            };

            const actions = [nodeUndoAction, nodeRedoAction, addChildAction, addDecorationSubmenu];
            actions.push(drillDownAction);
            actions.push(copyAction, pasteNodeAction, newNodeAction, deleteAction);
            return actions;
        }

        // ── 右键点击空白区域 ──────────────────────────────────────────────
        const selectedNodes = nodes.filter((n) => n.selected && !n.data?.isRoot);
        const newNodeAction: ContextMenuAction = {
            label: '新建节点',
            icon: <AddIcon />,
            onClick: () => {
                pushHistory();
                setNodes((nds) => [...nds, createNode(flowPos)]);
            },
        };

        // 撤销/重做（始终显示在最顶部）
        const undoAction: ContextMenuAction = {
            label: historyRef.current.length > 0 ? `撤销 (${historyRef.current.length})` : '撤销',
            icon: <UndoIcon />,
            shortcut: 'Ctrl+Z',
            onClick: undo,
            dividerAfter: true,
        };
        const redoAction: ContextMenuAction = {
            label: futureRef.current.length > 0 ? `重做 (${futureRef.current.length})` : '重做',
            icon: <RedoIcon />,
            shortcut: 'Ctrl+Y',
            onClick: redo,
            dividerAfter: true,
        };

        // 空白区域的粘贴：在右键点击位置粘贴
        const pasteAtPosAction: ContextMenuAction = {
            label: '粘贴',
            icon: <PasteIcon />,
            shortcut: 'Ctrl+V',
            disabled: clipboard.length === 0,
            onClick: () => {
                if (clipboard.length === 0) return;
                pushHistory();
                const newNodes = clipboard.map((n, i) => ({
                    ...n,
                    id: genId('node'),
                    position: { x: flowPos.x + i * 20, y: flowPos.y + i * 20 },
                    data: { ...n.data, isRoot: false },
                    selected: true,
                }));
                setNodes((nds) => [
                    ...nds.map((n) => ({ ...n, selected: false })),
                    ...newNodes,
                ]);
            },
        };

        // 若有多个选中节点，补充批量操作
        if (selectedNodes.length > 0) {
            const deleteSelectedAction: ContextMenuAction = {
                label: `删除选中节点 (${selectedNodes.length})`,
                icon: <TrashIcon />,
                danger: true,
                onClick: () => {
                    pushHistory();
                    const toDelete = new Set<string>();
                    selectedNodes.forEach((n) => {
                        toDelete.add(n.id);
                        collectDescendants(n.id, edges).forEach((id) => toDelete.add(id));
                    });
                    const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
                    const nextEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
                    setEdges(nextEdges);
                    setNodes(reLayout(nextNodes, nextEdges));
                },
            };
            return [undoAction, redoAction, newNodeAction, pasteAtPosAction, deleteSelectedAction];
        }

        return [undoAction, redoAction, newNodeAction, pasteAtPosAction];
    }, [contextMenu, nodes, edges, clipboard, setNodes, setEdges, setClipboard, createNode, reLayout, screenToFlowPosition, pushHistory, undo, redo, updateDecoration, removeDecoration, drillDown]);

    // ─── 折叠：计算需要隐藏的节点/边（不修改 nodes 状态,仅影响渲染） ──────────
    const hiddenNodeIds = useMemo(() => {
        const hasCollapsed = nodes.some((n) => n.data?.collapsed);
        if (!hasCollapsed) return EMPTY_ID_SET;
        return getHiddenNodeIds(nodes, edges);
    }, [nodes, edges]);

    // ─── 下钻：计算可见的节点 ID 集合 ────────────────────────────────────
    const drillVisibleIds = useMemo(() => {
        if (drillStack.length === 0) return null; // null = 不过滤
        const drillRootId = drillStack[drillStack.length - 1];
        const descendants = collectDescendants(drillRootId, edges);
        return new Set([drillRootId, ...descendants]);
    }, [drillStack, edges]);

    const displayNodes = useMemo(
        () => {
            let result = nodes;

            // 下钻过滤
            if (drillVisibleIds) {
                result = result.map((n) => {
                    const shouldShow = drillVisibleIds.has(n.id);
                    if (shouldShow === !n.hidden) return n;
                    return { ...n, hidden: !shouldShow };
                });
            }

            // 折叠隐藏
            if (hiddenNodeIds.size > 0) {
                result = result.map((n) => {
                    const shouldHide = hiddenNodeIds.has(n.id) || (drillVisibleIds ? !drillVisibleIds.has(n.id) : false);
                    if (!!n.hidden === shouldHide) return n;
                    return { ...n, hidden: shouldHide };
                });
            }

            return result;
        },
        [nodes, hiddenNodeIds, drillVisibleIds],
    );

    const displayEdges = useMemo(
        () => {
            const hiddenSet = new Set<string>();
            // 合并折叠隐藏和下钻不可见
            hiddenNodeIds.forEach((id) => hiddenSet.add(id));
            if (drillVisibleIds) {
                edges.forEach((e) => {
                    if (!drillVisibleIds.has(e.source) || !drillVisibleIds.has(e.target)) {
                        hiddenSet.add(e.source);
                        hiddenSet.add(e.target);
                    }
                });
            }
            if (hiddenSet.size === 0 && !drillVisibleIds) return edges;
            return edges.map((e) => {
                const shouldHide = hiddenSet.has(e.source) || hiddenSet.has(e.target)
                    || (drillVisibleIds ? (!drillVisibleIds.has(e.source) || !drillVisibleIds.has(e.target)) : false);
                if (!!e.hidden === shouldHide) return e;
                return { ...e, hidden: shouldHide };
            });
        },
        [edges, hiddenNodeIds, drillVisibleIds],
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#061616' }}>
                <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#c31432', borderTopColor: 'transparent' }}
                />
            </div>
        );
    }

    // 选中节点的主题色
    const selectedNodeColor = selectedNode
        ? ((selectedNode.data as MindNodeData)?.decorations?.highlight ?? '#c31432')
        : '#c31432';

    return (
        <div
            ref={containerRef}
            className="w-full h-[100dvh] relative overflow-hidden outline-none"
            style={{ background: '#061616' }}
            tabIndex={-1}
        >
            {/* 背景渐变 */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 160% 100% at 50% 50%, #0a2d2d 0%, #061616 100%)' }}
            />

            {/* ── ReactFlow 画布（底层） ── */}
            <div
                className="absolute inset-0"
                style={{
                    paddingTop: isMobileLayout ? 56 : 64,
                    paddingBottom: isMobileLayout ? 96 : 0,
                }}
                onContextMenu={onContextMenu}
                onDoubleClick={onCanvasDoubleClick}
                onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.isContentEditable && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                        containerRef.current?.focus();
                    }
                }}
            >
                <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChangeWithLayout}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStart={onNodeDragStart}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    onPaneClick={onPaneClick}
                    defaultViewport={map?.viewport || { x: 0, y: 0, zoom: 1 }}
                    zoomOnDoubleClick={false}
                    defaultEdgeOptions={{ type: 'hierarchyEdge' }}
                    style={{ background: 'transparent' }}
                    onContextMenu={(e) => e.preventDefault()}
                    panOnDrag={[2]}
                    selectionOnDrag={true}
                    selectionMode={SelectionMode.Partial}
                    panOnScroll={true}
                    onMoveEnd={(_, viewport) => setZoomLevel(Math.round(viewport.zoom * 100))}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
                    <MiniMap
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            width: 160,
                            height: 112,
                            opacity: 0.6,
                            bottom: 32,
                            right: 32,
                        }}
                        maskColor="rgba(6,22,22,0.6)"
                        nodeColor={(n) => (n.data as MindNodeData)?.decorations?.highlight || '#c31432'}
                    />
                </ReactFlow>
            </div>

            {/* ── Header ── */}
            <header
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between border-b"
                style={{
                    height: isMobileLayout ? 56 : 64,
                    padding: isMobileLayout ? '0 12px' : '0 25px',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                }}
            >
                {/* 左侧：Logo + 面包屑 */}
                <div className="flex items-center" style={{ gap: isMobileLayout ? 8 : 16 }}>
                    {isMobileLayout && (
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="rounded-md border text-white/90 hover:bg-white/10"
                            style={{
                                width: 28,
                                height: 28,
                                borderColor: 'rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.04)',
                            }}
                            title="返回工作区"
                        >
                            ←
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/editor/logo.svg" alt="logo" style={{ width: isMobileLayout ? 24 : 30, height: isMobileLayout ? 23 : 28.77 }} />
                        <span style={{ fontSize: isMobileLayout ? 16 : 20, fontWeight: 700, letterSpacing: '-0.5px', color: '#fff', lineHeight: 1 }}>
                            MindFlow <span style={{ color: '#c31432' }}>Pro</span>
                        </span>
                    </div>
                    {!isMobileLayout && <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />}
                    <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="transition-colors hover:text-white"
                            style={{ fontSize: 14, color: '#94a3b8', display: isMobileLayout ? 'none' : 'inline-flex' }}
                        >
                            My Workspace
                        </button>
                        {!isMobileLayout && (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/editor/breadcrumb-chevron.svg" alt="" style={{ width: 3.849, height: 6.508, opacity: 0.6 }} />
                            </>
                        )}
                        <span
                            style={{
                                fontSize: isMobileLayout ? 12 : 14,
                                fontWeight: 500,
                                color: '#fff',
                                maxWidth: isMobileLayout ? 130 : 320,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {map?.title || 'Untitled Project'}
                        </span>
                        {!isMobileLayout && nodes.length > 0 && (
                            <span
                                className="text-xs px-2 py-0.5 rounded-full ml-1"
                                style={{ background: 'rgba(195,20,50,0.15)', color: '#c31432', border: '1px solid rgba(195,20,50,0.3)' }}
                            >
                                {nodes.length} 个主题
                            </span>
                        )}
                        {!isMobileLayout && drillStack.length > 0 && (
                            <button
                                onClick={drillUp}
                                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ml-1"
                                style={{ color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                ← 退出下钻（层级 {drillStack.length}）
                            </button>
                        )}
                    </div>
                </div>

                {/* 右侧：保存状态 + 按钮 + 头像 */}
                <div className="flex items-center" style={{ gap: isMobileLayout ? 8 : 16 }}>
                    {isSaving && (
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>保存中...</span>
                    )}
                    {isMobileLayout && (
                        <button
                            className="rounded-md border text-xs text-white/90 hover:bg-white/10"
                            style={{
                                height: 32,
                                padding: '0 10px',
                                borderColor: 'rgba(255,255,255,0.2)',
                                background: 'rgba(255,255,255,0.04)',
                            }}
                            onClick={() => setIsMobilePropsOpen((prev) => !prev)}
                        >
                            {isMobilePropsOpen ? '收起属性' : '属性'}
                        </button>
                    )}
                    <button
                        className="flex items-center gap-2 rounded-lg font-medium text-white border transition-colors hover:bg-white/10"
                        style={{
                            padding: isMobileLayout ? '8px 10px' : '9px 17px',
                            fontSize: isMobileLayout ? 12 : 14,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/editor/share-icon.svg" alt="" style={{ width: 13.5, height: 14.941 }} />
                        {!isMobileLayout && 'Share'}
                    </button>
                    {!isMobileLayout && (
                        <>
                            <button
                                className="flex items-center gap-2 rounded-lg font-medium text-white transition-colors"
                                style={{ padding: '8px 16px', fontSize: 14, background: '#c31432', boxShadow: '0 10px 15px -3px rgba(195,20,50,0.2)' }}
                                onClick={() => toast.info('Export is coming soon')}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/editor/export-icon.svg" alt="" style={{ width: 10.477, height: 12.762 }} />
                                Export
                            </button>
                            <div
                                className="flex items-center justify-center rounded-full text-xs font-bold text-white border border-white/20 flex-shrink-0"
                                style={{ width: 32, height: 32, background: 'linear-gradient(45deg, #c31432 0%, #d946ef 100%)' }}
                            >
                                JD
                            </div>
                        </>
                    )}
                </div>
            </header>

            {/* ── 左侧工具栏 ── */}
            <aside
                className="absolute z-20 flex flex-col items-center rounded-2xl border"
                style={{
                    left: isMobileLayout ? 12 : 24,
                    top: isMobileLayout ? 'auto' : 325.5,
                    bottom: isMobileLayout ? 108 : 'auto',
                    gap: isMobileLayout ? 16 : 24,
                    padding: isMobileLayout ? '14px 2px' : '25px 1px',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                }}
            >
                {/* 选择 */}
                <button
                    onClick={() => setActiveTool('select')}
                    className="p-2 rounded-xl transition-colors hover:bg-white/10"
                    style={activeTool === 'select' ? { background: 'rgba(255,255,255,0.1)' } : {}}
                    title="Select (V)"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/select-tool.svg" alt="select" style={{ width: 16.672, height: 16.672 }} />
                </button>

                {/* 添加节点 */}
                <button
                    onClick={() => setActiveTool('addNode')}
                    className="rounded-xl transition-colors relative"
                    style={activeTool === 'addNode' ? {
                        padding: 9,
                        background: 'rgba(195,20,50,0.2)',
                        border: '1px solid rgba(195,20,50,0.5)',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                    } : { padding: 9 }}
                    title="Add Node (N)"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/add-node.svg" alt="add" style={{ width: 19.969, height: 19.969 }} />
                </button>

                {/* 连线 */}
                <button
                    onClick={() => setActiveTool('connect')}
                    className="p-2 rounded-xl transition-colors hover:bg-white/10"
                    style={activeTool === 'connect' ? { background: 'rgba(255,255,255,0.1)' } : {}}
                    title="Connect (C)"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/connect.svg" alt="connect" style={{ width: 22.031, height: 12 }} />
                </button>

                {/* 分割线 */}
                <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)' }} />

                {/* 样式 */}
                <button
                    className="p-2 rounded-xl transition-colors hover:bg-white/10"
                    title="Styles"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/styles.svg" alt="styles" style={{ width: 19.969, height: 19.969 }} />
                </button>

                {/* 媒体 */}
                <button
                    className="p-2 rounded-xl transition-colors hover:bg-white/10"
                    title="Media"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/media.svg" alt="media" style={{ width: 18, height: 18 }} />
                </button>
            </aside>

            {/* ── 右侧节点属性面板 ── */}
            <aside
                className="absolute z-20 rounded-2xl border overflow-hidden flex flex-col transition-transform duration-300"
                style={{
                    right: isMobileLayout ? 12 : 24,
                    left: isMobileLayout ? 12 : 'auto',
                    top: isMobileLayout ? 'auto' : 247,
                    bottom: isMobileLayout ? 12 : 'auto',
                    width: isMobileLayout ? 'auto' : 288,
                    height: isMobileLayout ? 'min(62dvh, 520px)' : 530,
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    transform: isMobileLayout && !isMobilePropsOpen ? 'translateY(calc(100% + 16px))' : 'translateY(0)',
                    pointerEvents: isMobileLayout && !isMobilePropsOpen ? 'none' : 'auto',
                }}
            >
                {/* 标题栏 */}
                <div
                    className="flex items-center gap-2 border-b flex-shrink-0"
                    style={{ padding: '20px', borderColor: 'rgba(255,255,255,0.05)' }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/node-props-icon.svg" alt="" style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', flex: 1 }}>Node Properties</span>
                    {isMobileLayout && (
                        <button
                            className="text-xs rounded-md px-2 py-1 border text-white/80 hover:bg-white/10"
                            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                            onClick={() => setIsMobilePropsOpen(false)}
                        >
                            收起
                        </button>
                    )}
                </div>

                {/* 内容 */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-6" style={{ padding: 20 }}>
                    {/* 标签文字 */}
                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#94a3b8' }}>
                            Label Text
                        </label>
                        <input
                            className="w-full rounded-lg text-white border outline-none transition-colors"
                            style={{
                                padding: '9px 13px',
                                fontSize: 14,
                                background: 'rgba(255,255,255,0.05)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                            value={selectedNode ? String(selectedNode.data?.label ?? '') : ''}
                            onChange={(e) => updateSelectedNodeLabel(e.target.value)}
                            placeholder={selectedNode ? '' : 'Select a node to edit'}
                            disabled={!selectedNode}
                        />
                    </div>

                    {/* 主题颜色 */}
                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#94a3b8' }}>
                            Theme Color
                        </label>
                        <div className="flex items-center" style={{ gap: 18.8 }}>
                            {(['#c31432', '#3b82f6', '#10b981', '#f59e0b', '#d946ef'] as const).map((color) => (
                                <button
                                    key={color}
                                    className="rounded-full flex-shrink-0 transition-transform hover:scale-110"
                                    style={{
                                        width: 32,
                                        height: 32,
                                        background: color,
                                        boxShadow: selectedNodeColor === color ? '0 0 0 4px white' : 'none',
                                    }}
                                    onClick={() => updateSelectedNodeColor(color)}
                                    disabled={!selectedNode}
                                />
                            ))}
                        </div>
                    </div>

                    {/* 节点图标 */}
                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#94a3b8' }}>
                            Node Icon
                        </label>
                        <div
                            className="flex items-center gap-3 rounded-xl border"
                            style={{ padding: 13, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/editor/rocket-icon.svg" alt="" style={{ width: 19.288, height: 19.288 }} />
                            <span style={{ fontSize: 14, color: '#fff', flex: 1 }}>Rocket Launch</span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/editor/chevron-down.svg" alt="" style={{ width: 6.508, height: 3.849, opacity: 0.6 }} />
                        </div>
                    </div>

                    {/* 分割线 */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

                    {/* 开关 */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span style={{ fontSize: 14, color: '#fff' }}>Auto-layout</span>
                            <button
                                className="relative rounded-full transition-colors"
                                style={{
                                    width: 40,
                                    height: 20,
                                    background: layoutStyle === 'mindmap' ? '#c31432' : 'rgba(255,255,255,0.15)',
                                }}
                                onClick={() => setLayoutStyle(layoutStyle === 'mindmap' ? 'tree-lr' : 'mindmap')}
                            >
                                <div
                                    className="absolute top-1 rounded-full bg-white transition-all"
                                    style={{
                                        width: 12,
                                        height: 12,
                                        right: layoutStyle === 'mindmap' ? 4 : 'auto',
                                        left: layoutStyle === 'mindmap' ? 'auto' : 4,
                                    }}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <span style={{ fontSize: 14, color: '#fff' }}>Glass Effect</span>
                            <div
                                className="relative rounded-full"
                                style={{ width: 40, height: 20, background: '#c31432' }}
                            >
                                <div className="absolute top-1 right-1 rounded-full bg-white" style={{ width: 12, height: 12 }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 删除按钮 */}
                <div className="flex-shrink-0" style={{ padding: 20, background: 'rgba(255,255,255,0.05)' }}>
                    <button
                        onClick={deleteSelectedNode}
                        disabled={!selectedNode || !!selectedNode.data?.isRoot}
                        className="w-full rounded-lg font-bold text-white text-center border transition-colors disabled:opacity-40 hover:bg-white/10"
                        style={{
                            padding: '9px 1px',
                            fontSize: 12,
                            background: 'rgba(255,255,255,0.05)',
                            borderColor: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        DELETE NODE
                    </button>
                </div>
            </aside>

            {/* ── 底部缩放工具栏 ── */}
            <div
                className="absolute left-1/2 z-20 flex items-center gap-4 rounded-full border"
                style={{
                    bottom: isMobileLayout ? 12 : 32,
                    transform: 'translateX(-50%)',
                    width: isMobileLayout ? 'calc(100vw - 24px)' : 288,
                    maxWidth: isMobileLayout ? 420 : 288,
                    padding: isMobileLayout ? '12px 16px' : '13px 25px',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    background: 'rgba(255,255,255,0.05)',
                    borderColor: 'rgba(255,255,255,0.1)',
                }}
            >
                {/* 缩放控件 */}
                <div className="flex items-center gap-2">
                    <button
                        className="p-1 rounded-md transition-colors hover:bg-white/10"
                        onClick={() => zoomOut({ duration: 200 })}
                        title="Zoom Out"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/editor/zoom-out.svg" alt="-" style={{ width: 13.969, height: 1.969 }} />
                    </button>
                    <span className="text-center font-bold text-white" style={{ fontSize: 12, width: 48 }}>{zoomLevel}%</span>
                    <button
                        className="p-1 rounded-md transition-colors hover:bg-white/10"
                        onClick={() => zoomIn({ duration: 200 })}
                        title="Zoom In"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/editor/zoom-in.svg" alt="+" style={{ width: 13.969, height: 13.969 }} />
                    </button>
                </div>

                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />

                {/* 适应视口 */}
                <button
                    className="p-1 rounded-md transition-colors hover:bg-white/10"
                    onClick={() => fitView({ padding: 0.2, duration: 400 })}
                    title="Fit View"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/fit-view.svg" alt="fit" style={{ width: 10.5, height: 10.5 }} />
                </button>

                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />

                <button className="p-1 rounded-md transition-colors hover:bg-white/10" title="Lock">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/editor/lock.svg" alt="lock" style={{ width: 10.477, height: 10.474 }} />
                </button>
            </div>

            {/* ── 右键菜单 ── */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    actions={buildContextMenuActions()}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>
    );
}

// 小图标组件
function PlusIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}
function AddIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M12 8v8M8 12h8" />
        </svg>
    );
}
function CopyIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
    );
}
function PasteIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" />
        </svg>
    );
}
function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
    );
}
function UndoIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M3 13C4.6 8.9 8.9 6 14 6c4.4 0 8.3 2.4 10 6" />
        </svg>
    );
}
function RedoIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M21 13C19.4 8.9 15.1 6 10 6c-4.4 0-8.3 2.4-10 6" />
        </svg>
    );
}
function PlusCircleIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
        </svg>
    );
}
function DrillDownIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
    );
}

// 公开的 MapEditor（注入 ReactFlowProvider）
export function MapEditor({ mapId }: { mapId: string }) {
    return (
        <ReactFlowProvider>
            <MapEditorInner mapId={mapId} />
        </ReactFlowProvider>
    );
}
