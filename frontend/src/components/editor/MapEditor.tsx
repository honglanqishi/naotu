'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ReactFlow,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
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
import { MindNode } from '@/components/editor/nodes/MindNode';
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
    const { screenToFlowPosition, fitView, getViewport } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const initializedRef = useRef(false);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [layoutStyle] = useState<LayoutStyle>('mindmap');
    /** 节点剪贴板：存储 Ctrl+C 复制的节点，用于 Ctrl+V 粘贴 */
    const [clipboard, setClipboard] = useState<Node[]>([]);
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
    const futureRef  = useRef<Snapshot[]>([]);

    /** 在执行任意变更操作前调用，把当前状态存入历史 */
    const pushHistory = useCallback(() => {
        historyRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
        if (historyRef.current.length > 50) historyRef.current.shift();
        futureRef.current = []; // 新操作清空 redo 栈
    }, []);

    const undo = useCallback(() => {
        const prev = historyRef.current.pop();
        if (!prev) { toast.info('没有可撤销的操作'); return; }
        futureRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
        setNodes(prev.nodes);
        setEdges(prev.edges);
    }, [setNodes, setEdges]);

    const redo = useCallback(() => {
        const next = futureRef.current.pop();
        if (!next) { toast.info('没有可重做的操作'); return; }
        historyRef.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
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

    // 自动保存（含 viewport）
    const isSaving = useAutoSave(mapId, nodes, edges, initializedRef.current, getViewport);

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
                setClipboard((cb) => {
                    if (cb.length === 0) return cb;
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
                    return cb; // 保持剪贴板内容，允许多次粘贴
                });
                return;
            }

            // ── Tab：新增子节点 ──────────────────────────────────────────
            if (e.key === 'Tab') {
                const selectedNode = nodes.find((n) => n.selected);
                if (!selectedNode) return;
                e.preventDefault();

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

        const container = containerRef.current;
        container?.addEventListener('keydown', handleKeyDown);
        return () => container?.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reLayout, setNodes, setEdges, undo, redo, pushHistory, setClipboard]); // 不依赖 nodes/edges，通过 ref 读取最新值

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

            // 根节点不显示删除选项
            if (isRoot) {
                return [nodeUndoAction, nodeRedoAction, addChildAction, copyAction, pasteNodeAction, newNodeAction];
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
                return [nodeUndoAction, nodeRedoAction, addChildAction, copyAction, pasteNodeAction, newNodeAction, batchDeleteAction];
            }

            const deleteAction: ContextMenuAction = {
                label: '删除节点（含子节点）',
                icon: <TrashIcon />,
                danger: true,
                onClick: () => {
                    pushHistory();
                    // 递归收集所有子孙节点 ID
                    const descendants = collectDescendants(targetNodeId, edges);
                    const toDelete = new Set([targetNodeId, ...descendants]);
                    const nextNodes = nodes.filter((n) => !toDelete.has(n.id));
                    const nextEdges = edges.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target));
                    setEdges(nextEdges);
                    // 删除后重新布局，确保兄弟节点位置正确对齐
                    setNodes(reLayout(nextNodes, nextEdges));
                },
            };

            return [nodeUndoAction, nodeRedoAction, addChildAction, copyAction, pasteNodeAction, newNodeAction, deleteAction];
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
    }, [contextMenu, nodes, edges, clipboard, setNodes, setEdges, setClipboard, createNode, reLayout, screenToFlowPosition, pushHistory, undo, redo]);

    // ─── 折叠：计算需要隐藏的节点/边（不修改 nodes 状态,仅影响渲染） ──────────
    // 无折叠节点时返回稳定空集合（EMPTY_ID_SET），避免 displayNodes memo 因新 Set 引用而失效
    const hiddenNodeIds = useMemo(() => {
        const hasCollapsed = nodes.some((n) => n.data?.collapsed);
        if (!hasCollapsed) return EMPTY_ID_SET;
        return getHiddenNodeIds(nodes, edges);
    }, [nodes, edges]);

    // 优化：无折叠节点时直接使用原 nodes 数组（避免 map 创建全新对象）
    const displayNodes = useMemo(
        () => {
            if (hiddenNodeIds.size === 0) return nodes;
            // 有折叠时，只为隐藏状态变化的节点创建新对象
            return nodes.map((n) => {
                const shouldHide = hiddenNodeIds.has(n.id);
                if (!!n.hidden === shouldHide) return n; // 引用不变
                return { ...n, hidden: shouldHide };
            });
        },
        [nodes, hiddenNodeIds],
    );

    const displayEdges = useMemo(
        () => {
            if (hiddenNodeIds.size === 0) return edges;
            return edges.map((e) => {
                const shouldHide = hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);
                if (!!e.hidden === shouldHide) return e;
                return { ...e, hidden: shouldHide };
            });
        },
        [edges, hiddenNodeIds],
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
                <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
                />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full h-screen flex flex-col outline-none"
            style={{ background: '#0f0f17' }}
            tabIndex={-1}
        >
            {/* 顶栏 */}
            <header
                className="flex items-center justify-between px-4 h-12 border-b z-10 flex-shrink-0"
                style={{ background: 'rgba(15,15,23,0.9)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-1.5 text-sm transition-colors"
                        style={{ color: 'var(--foreground-muted)' }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        返回
                    </button>
                    <span style={{ color: 'var(--border)' }}></span>
                    <h1 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {map?.title}
                    </h1>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                        {nodes.length} 个主题
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isSaving && (
                        <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>
                            保存中...
                        </span>
                    )}
                </div>
            </header>

            {/* ReactFlow 画布 */}
            <div
                className="flex-1"
                onContextMenu={onContextMenu}
                onDoubleClick={onCanvasDoubleClick}
                onMouseDown={(e) => {
                    // 点击画布任意区域（非富文本编辑框/输入框）时，将焦点归还给容器
                    // 保证键盘快捷键（Tab/Delete/Ctrl+Z 等）始终可用
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
                    style={{ background: '#0f0f17' }}
                    onContextMenu={(e) => e.preventDefault()}
                    /* ── 交互模式 ──────────────────────────────────────────
                       右键拖拽 = 平移画布（panOnDrag: [2] 对应鼠标右键）
                       左键拖拽 = 矩形框选（selectionOnDrag: true）
                    ─────────────────────────────────────────────────────── */
                    panOnDrag={[2]}
                    selectionOnDrag={true}
                    selectionMode={SelectionMode.Partial}
                    panOnScroll={true}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
                    <Controls style={{ background: 'rgba(26,26,46,0.9)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                    <MiniMap
                        style={{ background: 'rgba(26,26,46,0.9)', border: '1px solid var(--border)', borderRadius: '12px' }}
                        maskColor="rgba(15,15,23,0.8)"
                        nodeColor="var(--primary)"
                    />
                </ReactFlow>
            </div>

            {/* 右键自定义菜单 */}
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

// 公开的 MapEditor（注入 ReactFlowProvider）
export function MapEditor({ mapId }: { mapId: string }) {
    return (
        <ReactFlowProvider>
            <MapEditorInner mapId={mapId} />
        </ReactFlowProvider>
    );
}
