'use client';

import { memo, useCallback, useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useReactFlow, useEdges, type NodeProps } from '@xyflow/react';

export interface MindNodeData extends Record<string, unknown> {
  /** 纯文本内容（用于布局计算、旧节点兼容、搜索等） */
  label: string;
  /** 富文本 HTML 内容（可选，存在时优先用于展示） */
  html?: string;
  isRoot?: boolean;
  isDropTarget?: boolean;
  /** 节点所在侧：left = 父节点在右边，right = 父节点在左边（默认） */
  side?: 'left' | 'right';
  /** 是否折叠子节点 */
  collapsed?: boolean;
}

/** 将纯文本安全转义为内联 HTML（保留换行） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/** 节点状态机: normal → editing → normal */
type EditState = 'normal' | 'editing';

export function MindNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as MindNodeData;
  const { updateNodeData } = useReactFlow();
  const allEdges = useEdges();
  const [editState, setEditState] = useState<EditState>('normal');
  const editorRef = useRef<HTMLDivElement>(null);

  // ── 图片全屏预览状态 ─────────────────────────────────────────
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const isDraggingImgRef = useRef(false);
  const imgDragRef = useRef({ startX: 0, startY: 0, startOffX: 0, startOffY: 0 });

  // 计算该节点是否有子节点（层级连接）
  // 使用 useEdges 保持响应式，边变化时自动更新
  const hasChildren = useMemo(
    () => allEdges.some((e) => e.source === id && (e.type === 'hierarchyEdge' || !e.type)),
    [id, allEdges],
  );

  const collapsed = !!nodeData.collapsed;

  /** 当前节点应展示的 HTML（优先 html 字段，降级为转义后的纯文本） */
  const displayHtml = nodeData.html ?? escapeHtml(nodeData.label);

  // ── 非编辑态时同步 innerHTML（useLayoutEffect 避免闪烁） ──────────────────
  useLayoutEffect(() => {
    if (editState === 'normal' && editorRef.current) {
      editorRef.current.innerHTML = displayHtml;
    }
  }, [editState, displayHtml]);

  // ── 进入编辑态：聚焦 → 全选文本 ────────────────────────────────────────
  useEffect(() => {
    if (editState === 'editing' && editorRef.current) {
      editorRef.current.focus();
      // 进入编辑态时全选文本，方便用户直接覆盖输入
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editState]);

  // ── 图片全屏预览：Esc 关闭 + 全局拖拽追踪 ───────────────────
  useEffect(() => {
    if (!fullscreenImg) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImg(null);
        setImgOffset({ x: 0, y: 0 });
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingImgRef.current) return;
      setImgOffset({
        x: imgDragRef.current.startOffX + e.clientX - imgDragRef.current.startX,
        y: imgDragRef.current.startOffY + e.clientY - imgDragRef.current.startY,
      });
    };
    const handleMouseUp = () => {
      isDraggingImgRef.current = false;
      setIsDraggingImg(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [fullscreenImg]);

  /** 提交编辑：保存 HTML + 提取纯文本 label。
   * 尺寸刷新由 ReactFlow 的 dimensions 事件自动触发 MapEditor 重新布局，无需手动 dispatch。
   */
  const commitEdit = useCallback(() => {
    if (!editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    const newLabel = (editorRef.current.innerText ?? '').trim() || nodeData.label;
    updateNodeData(id, { label: newLabel, html: newHtml });
    setEditState('normal');
  }, [id, nodeData.label, updateNodeData]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      // 非编辑态下双击图片 → 全屏预览
      if (editState === 'normal') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'IMG') {
          const src = (target as HTMLImageElement).src;
          setFullscreenImg(src);
          setImgOffset({ x: 0, y: 0 });
          return;
        }
      }

      if (editState === 'editing') {
        // 编辑态下双击 → 全选文本
        if (editorRef.current) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        return;
      }
      setEditState('editing');
    },
    [editState],
  );

  const handleBlur = useCallback(() => {
    if (editState === 'editing') {
      commitEdit();
    }
  }, [editState, commitEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // 必须阻止冒泡：防止画布键盘快捷键（Tab/Delete/Ctrl+Z 等）在编辑态误触发
      e.stopPropagation();

      // Enter：提交并退出编辑；Alt+Enter：插入换行
      if (e.key === 'Enter') {
        if (e.altKey) {
          // Alt+Enter：论入换行符
          e.preventDefault();
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          document.execCommand('insertLineBreak', false);
          return;
        }
        // 普通 Enter：提交并退出编辑
        e.preventDefault();
        commitEdit();
        return;
      }

      // Escape：保持内容提交并退出编辑，同时刺激布局刷新
      if (e.key === 'Escape') {
        e.preventDefault();
        commitEdit();
        return;
      }

      // ── 富文本格式化快捷键（Ctrl+B/I/U） ────────────────────────────────
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand('bold', false);
            return;
          case 'i':
            e.preventDefault();
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand('italic', false);
            return;
          case 'u':
            e.preventDefault();
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand('underline', false);
            return;
          // Ctrl+C/V/Z 交给浏览器默认行为（contentEditable 内部剪贴板/撤销）
        }
      }
    },
    [commitEdit],
  );

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateNodeData(id, { collapsed: !collapsed });
    },
    [id, collapsed, updateNodeData],
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

      {/* 节点主体（尺寸随内容自动撑开） */}
      {/* 编辑态加 nodrag nopan，防止 ReactFlow 拦截鼠标，确保文本可自由选取 */}
      <div
        onDoubleClick={handleDoubleClick}
        className={editState === 'editing' ? 'nodrag nopan' : undefined}
        style={{
          minWidth: isRoot ? 120 : 80,
          maxWidth: 300,
          minHeight: isRoot ? 36 : 28,
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
          userSelect: editState === 'editing' ? 'text' : 'none',
          position: 'relative',
          overflow: 'visible',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/*
         * 富文本编辑区（展示和编辑共用同一 div，避免状态切换闪烁）
         * - 非编辑态：contentEditable=false，内容由 useLayoutEffect 通过 innerHTML 管理
         * - 编辑态：contentEditable=true，内容由浏览器接管，React 不干预
         * suppressContentEditableWarning 抑制 React 的 children 警告
         * 支持格式化：Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+U 下划线、Enter 换行、Escape 取消
         */}
        <div
          ref={editorRef}
          contentEditable={editState === 'editing'}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={editState === 'editing' ? (e) => e.stopPropagation() : undefined}
          style={{
            outline: 'none',
            color: isRoot ? 'white' : 'var(--foreground)',
            fontSize: isRoot ? 14 : 13,
            fontWeight: isRoot ? 600 : 400,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
            textAlign: editState === 'editing' ? 'left' : 'center',
            cursor: 'inherit',
            width: '100%',
          }}
        />

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

        {/* 折叠/展开按钮：仅在有子节点且非编辑态时显示 */}
        {hasChildren && editState === 'normal' && (
          <div
            className="nodrag nopan"
            onClick={handleToggleCollapse}
            title={collapsed ? '展开子节点' : '折叠子节点'}
            style={{
              position: 'absolute',
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

      {/* 图片全屏预览 Portal：可拖动、Esc 关闭、点击功画外关闭 */}
      {fullscreenImg && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => { setFullscreenImg(null); setImgOffset({ x: 0, y: 0 }); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="fullscreen-preview"
            src={fullscreenImg}
            draggable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              isDraggingImgRef.current = true;
              setIsDraggingImg(true);
              imgDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                startOffX: imgOffset.x,
                startOffY: imgOffset.y,
              };
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'none',
              maxHeight: 'none',
              transform: `translate(${imgOffset.x}px, ${imgOffset.y}px)`,
              cursor: isDraggingImg ? 'grabbing' : 'grab',
              userSelect: 'none',
              display: 'block',
            }}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * 用 React.memo 包装，自定义比较函数：
 * 仅当 id / data / selected 真正变化时才重渲染。
 */
export const MindNode = memo(MindNodeComponent, (prev, next) => {
  if (prev.id !== next.id) return false;
  if (prev.selected !== next.selected) return false;
  const pd = prev.data as MindNodeData;
  const nd = next.data as MindNodeData;
  return (
    pd.label === nd.label &&
    pd.html === nd.html &&
    pd.isRoot === nd.isRoot &&
    pd.isDropTarget === nd.isDropTarget &&
    pd.side === nd.side &&
    pd.collapsed === nd.collapsed
  );
});