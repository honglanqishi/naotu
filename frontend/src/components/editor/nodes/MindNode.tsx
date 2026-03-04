'use client';

import { memo, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, type NodeProps } from '@xyflow/react';

export interface MindNodeData extends Record<string, unknown> {
  label: string;
  isRoot?: boolean;
  isDropTarget?: boolean;
  /** 节点所在侧：left = 父节点在右边，right = 父节点在左边（默认） */
  side?: 'left' | 'right';
  /** 是否折叠子节点 */
  collapsed?: boolean;
}

/** 节点状态机: normal → selected → editing → normal */
type EditState = 'normal' | 'editing';

export function MindNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as MindNodeData;
  const { updateNodeData } = useReactFlow();
  const allEdges = useEdges();
  const [editState, setEditState] = useState<EditState>('normal');
  const inputRef = useRef<HTMLInputElement>(null);

  // 计算该节点是否有子节点（层级连接）
  // 使用 useEdges 保持响应式，边变化时自动更新
  const hasChildren = useMemo(
    () => allEdges.some((e) => e.source === id && (e.type === 'hierarchyEdge' || !e.type)),
    [id, allEdges],
  );

  const collapsed = !!nodeData.collapsed;

  /** 折叠/展开切换 */
  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateNodeData(id, { collapsed: !collapsed });
    },
    [id, collapsed, updateNodeData],
  );

  // 进入编辑态时自动聚焦 input
  useEffect(() => {
    if (editState === 'editing' && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editState]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      // 阻止冒泡：防止外层 div 的 onDoubleClick（新建浮动节点）被触发
      e.stopPropagation();
      setEditState('editing');
    },
    [],
  );

  // 单击不阻止冒泡，让 ReactFlow 正常处理节点选中（边框高亮依赖 selected prop）
  const handleClick = useCallback((_e: React.MouseEvent) => {}, []);

  const commitEdit = useCallback(
    (value: string) => {
      const trimmed = value.trim() || nodeData.label;
      updateNodeData(id, { label: trimmed });
      setEditState('normal');
    },
    [id, nodeData.label, updateNodeData],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      commitEdit(e.target.value);
    },
    [commitEdit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit(e.currentTarget.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditState('normal');
      }
      // 阻止冒泡，防止触发画布快捷键（如 Tab/Delete）
      e.stopPropagation();
    },
    [commitEdit],
  );

  const isRoot = nodeData.isRoot;
  const isDropTarget = nodeData.isDropTarget;
  // side='left' 表示节点在根节点左侧：父节点在右，子节点继续向左
  const isLeftSide = nodeData.side === 'left';
  const targetPos = isLeftSide ? Position.Right : Position.Left;
  const sourcePos = isLeftSide ? Position.Left : Position.Right;

  return (
    <>
      {/* 输入连接 handle（根节点无输入） */}
      {!isRoot && (
        <Handle
          type="target"
          position={targetPos}
          style={{
            width: 8,
            height: 8,
            background: 'var(--primary)',
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        />
      )}

      {/* 节点主体 */}
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{
          minWidth: isRoot ? 100 : 80,
          maxWidth: 240,
          padding: isRoot ? '8px 20px' : '6px 14px',
          borderRadius: isRoot ? 20 : 12,
          background: isRoot
            ? 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #8b5cf6))'
            : 'rgba(26,26,46,0.95)',
          border: isDropTarget
            ? '2px solid #f59e0b'
            : selected
              ? '2px solid var(--primary)'
              : isRoot
                ? '2px solid transparent'
                : '1.5px solid rgba(255,255,255,0.12)',
          boxShadow: isDropTarget
            ? '0 0 0 4px rgba(245,158,11,0.25)'
            : selected
              ? '0 0 0 3px rgba(var(--primary-rgb, 99,102,241),0.25)'
              : isRoot
                ? '0 4px 24px rgba(0,0,0,0.4)'
                : '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          cursor: editState === 'editing' ? 'text' : 'default',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {editState === 'editing' ? (
          <input
            ref={inputRef}
            defaultValue={nodeData.label}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isRoot ? 'white' : 'var(--foreground)',
              fontSize: isRoot ? 14 : 13,
              fontWeight: isRoot ? 600 : 400,
              width: '100%',
              textAlign: 'center',
              minWidth: 60,
            }}
          />
        ) : (
          <span
            style={{
              color: isRoot ? 'white' : 'var(--foreground)',
              fontSize: isRoot ? 14 : 13,
              fontWeight: isRoot ? 600 : 400,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textAlign: 'center',
              display: 'block',
            }}
          >
            {nodeData.label}
          </span>
        )}

        {/* 吸附指示环 */}
        {isDropTarget && (
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: isRoot ? 26 : 18,
              border: '2px dashed #f59e0b',
              pointerEvents: 'none',
              animation: 'pulse 1s infinite',
            }}
          />
        )}

        {/* 折叠/展开按钮：仅在有子节点时显示 */}
        {hasChildren && (
          <div
            className="nodrag nopan"
            onClick={handleToggleCollapse}
            title={collapsed ? '展开子节点' : '折叠子节点'}
            style={{
              position: 'absolute',
              // 根据节点方向决定按钮位置（源连接一侧）
              [isLeftSide ? 'left' : 'right']: -22,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: collapsed
                ? 'var(--primary)'
                : 'rgba(26,26,46,0.9)',
              border: `1.5px solid var(--primary)`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              color: collapsed ? 'white' : 'var(--primary)',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              transition: 'background 0.2s ease, color 0.2s ease, transform 0.2s ease',
              userSelect: 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {/* 折叠时显示 ▶，展开时显示 ▼（根据方向镜像） */}
            <svg
              width="7"
              height="7"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{
                transform: collapsed
                  ? isLeftSide ? 'rotate(180deg)' : 'rotate(0deg)'
                  : 'rotate(90deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <path d="M8 5l8 7-8 7Z" />
            </svg>
          </div>
        )}
      </div>

      {/* 输出连接 handle */}
      <Handle
        type="source"
        position={sourcePos}
        style={{
          width: 8,
          height: 8,
          background: 'var(--primary)',
          border: '2px solid rgba(255,255,255,0.3)',
        }}
      />
    </>
  );
}

/**
 * 用 React.memo 包装，自定义比较函数：
 * 仅当 id / data / selected 真正变化时才重渲染。
 * 如此，拖拽其他节点时不会触发不相关节点的重渲染。
 */
export const MindNode = memo(MindNodeComponent, (prev, next) => {
  if (prev.id !== next.id) return false;
  if (prev.selected !== next.selected) return false;
  // data 是普通对象，做浅对比（label / isRoot / isDropTarget / side / collapsed）
  const pd = prev.data as MindNodeData;
  const nd = next.data as MindNodeData;
  return (
    pd.label === nd.label &&
    pd.isRoot === nd.isRoot &&
    pd.isDropTarget === nd.isDropTarget &&
    pd.side === nd.side &&
    pd.collapsed === nd.collapsed
  );
});