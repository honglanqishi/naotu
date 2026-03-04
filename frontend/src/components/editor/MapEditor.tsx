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
    findNearestNode,
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

// ─── 全局唯一 ID 生成器（避免 Date.now() 在同一 tick 内重复） ──────────────────
let _idCounter = 0;
function genId(prefix: string) {
    return `${prefix}-${Date.now()}-${++_idCounter}`;
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
    const containerRef = useRef<HTMLDivElement>(null);
    const dropTargetRef = useRef<string | null>(null);
    // 追踪右键是否发生拖拽（平移），避免平移后弹出右键菜单
    const rightDragRef = useRef({ startX: 0, startY: 0, moved: false });
    // 用 ref 持有最新 nodes/edges，供键盘 handler 使用，避免 useEffect 频繁重新注册
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    nodesRef.current = nodes;
    edgesRef.current = edges;

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
            const newEdge: Edge = {
                ...connection,
                id: genId('edge'),
                type: 'hierarchyEdge',
            };
            const nextEdges = addEdge(newEdge, edges);
            setEdges(nextEdges);
            setNodes((nds) => reLayout(nds, nextEdges));
        },
        [edges, setEdges, setNodes, reLayout],
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

    // 拖拽过程：检测吸附目标（通过 ref 读取最新 nodes，避免重建回调）
    const onNodeDrag = useCallback(
        (_e: React.MouseEvent, draggedNode: Node) => {
            const nearest = findNearestNode(nodesRef.current, draggedNode.id, draggedNode.position, 100);

            if (nearest !== dropTargetRef.current) {
                if (dropTargetRef.current) {
                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === dropTargetRef.current
                                ? { ...n, data: { ...n.data, isDropTarget: false } }
                                : n,
                        ),
                    );
                }
                if (nearest) {
                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === nearest
                                ? { ...n, data: { ...n.data, isDropTarget: true } }
                                : n,
                        ),
                    );
                }
                dropTargetRef.current = nearest;
            }
        },
        [setNodes], // 不依赖 nodes，通过 nodesRef.current 读取
    );

    // 拖拽结束：若有吸附目标，建立父子关系并重新布局（通过 ref 读取最新 edges）
    const onNodeDragStop = useCallback(
        (_e: React.MouseEvent, draggedNode: Node) => {
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

            const newEdge: Edge = {
                id: genId('edge'),
                source: targetId,
                target: draggedNode.id,
                type: 'hierarchyEdge',
            };

            const nextEdges = [...edgesRef.current, newEdge];
            setEdges(nextEdges);
            setNodes((nds) => reLayout(nds, nextEdges));
        },
        [setEdges, setNodes, reLayout], // 不依赖 edges，通过 edgesRef.current 读取
    );

    // 键盘事件：Tab 新增子节点 / Delete 删除选中节点
    // 通过 ref 读取最新 nodes/edges，useEffect 只注册一次，避免每帧重新绑定
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const nodes = nodesRef.current;
            const edges = edgesRef.current;

            // ── Tab：新增子节点 ──────────────────────────────────────────
            if (e.key === 'Tab') {
                const selectedNode = nodes.find((n) => n.selected);
                if (!selectedNode) return;
                e.preventDefault();

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

            // ── Delete / Backspace：删除选中节点（跳过根节点和编辑中的输入框） ──
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // 如果焦点在输入框里，让输入框自己处理
                if (
                    document.activeElement instanceof HTMLInputElement ||
                    document.activeElement instanceof HTMLTextAreaElement
                ) return;

                const selectedNodes = nodes.filter((n) => n.selected && !n.data?.isRoot);
                if (selectedNodes.length === 0) return;
                e.preventDefault();

                // 收集所有要删除的节点（含子孙）
                const toDelete = new Set<string>();
                selectedNodes.forEach((n) => {
                    toDelete.add(n.id);
                    collectDescendants(n.id, edges).forEach((id) => toDelete.add(id));
                });

                setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
                setEdges((eds) =>
                    eds.filter((edge) => !toDelete.has(edge.source) && !toDelete.has(edge.target)),
                );
            }
        };

        const container = containerRef.current;
        container?.addEventListener('keydown', handleKeyDown);
        return () => container?.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reLayout, setNodes, setEdges]); // 不依赖 nodes/edges，通过 ref 读取最新值

    // 右键菜单：禁用浏览器默认菜单
    const onContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        // 若右键拖拽了（平移画布），则不弹出菜单
        if (rightDragRef.current.moved) return;
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
                label: '复制节点',
                icon: <CopyIcon />,
                onClick: () => {
                    const original = nodes.find((n) => n.id === targetNodeId);
                    if (!original) return;
                    setNodes((nds) => [
                        ...nds,
                        {
                            ...original,
                            id: genId('node'),
                            position: { x: original.position.x + 40, y: original.position.y + 40 },
                            data: { ...original.data, isRoot: false },
                            selected: false,
                        },
                    ]);
                },
            };

            const newNodeAction: ContextMenuAction = {
                label: '新建节点',
                icon: <AddIcon />,
                onClick: () => setNodes((nds) => [...nds, createNode(flowPos)]),
                dividerAfter: !isRoot,
            };

            // 根节点不显示删除选项
            if (isRoot) {
                return [addChildAction, copyAction, newNodeAction];
            }

            const deleteAction: ContextMenuAction = {
                label: '删除节点（含子节点）',
                icon: <TrashIcon />,
                danger: true,
                onClick: () => {
                    // 递归收集所有子孙节点 ID
                    const descendants = collectDescendants(targetNodeId, edges);
                    const toDelete = new Set([targetNodeId, ...descendants]);
                    setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
                    setEdges((eds) => eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)));
                },
            };

            return [addChildAction, copyAction, newNodeAction, deleteAction];
        }

        // ── 右键点击空白区域 ──────────────────────────────────────────────
        const selectedNodes = nodes.filter((n) => n.selected && !n.data?.isRoot);
        const newNodeAction: ContextMenuAction = {
            label: '新建节点',
            icon: <AddIcon />,
            onClick: () => setNodes((nds) => [...nds, createNode(flowPos)]),
        };

        // 若有多个选中节点，补充批量操作
        if (selectedNodes.length > 0) {
            const deleteSelectedAction: ContextMenuAction = {
                label: `删除选中节点 (${selectedNodes.length})`,
                icon: <TrashIcon />,
                danger: true,
                onClick: () => {
                    const toDelete = new Set<string>();
                    selectedNodes.forEach((n) => {
                        toDelete.add(n.id);
                        collectDescendants(n.id, edges).forEach((id) => toDelete.add(id));
                    });
                    setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
                    setEdges((eds) =>
                        eds.filter((e) => !toDelete.has(e.source) && !toDelete.has(e.target)),
                    );
                },
            };
            return [newNodeAction, deleteSelectedAction];
        }

        return [newNodeAction];
    }, [contextMenu, nodes, edges, setNodes, setEdges, createNode, reLayout, screenToFlowPosition]);

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
            onMouseDown={(e) => {
                // 追踪右键按下位置，用于判断是否发生了平移拖拽
                if (e.button === 2) {
                    rightDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
                }
            }}
            onMouseMove={(e) => {
                if (e.buttons === 2) {
                    const dx = e.clientX - rightDragRef.current.startX;
                    const dy = e.clientY - rightDragRef.current.startY;
                    if (Math.sqrt(dx * dx + dy * dy) > 5) {
                        rightDragRef.current.moved = true;
                    }
                }
            }}
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
            >
                <ReactFlow
                    nodes={displayNodes}
                    edges={displayEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
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
function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
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
