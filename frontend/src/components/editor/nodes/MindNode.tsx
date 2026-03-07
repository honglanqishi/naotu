'use client';

import { memo, useCallback, useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, NodeToolbar, useReactFlow, useEdges, useStore, type NodeProps } from '@xyflow/react';
import { RichTextToolbar } from '@/components/editor/RichTextToolbar';
import { useSession } from '@/lib/auth-client';
import { CommentPopover } from '../decorations/CommentPopover';
import { HyperlinkBadge } from '../decorations/HyperlinkBadge';
import { NotePopover } from '../decorations/NotePopover';
import { TagPopover } from '../decorations/TagPopover';
import { TodoCheckbox } from '../decorations/TodoCheckbox';

export interface TodoReminder {
  email: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  remind: string;
  notes?: string;
}

export interface NodeDecoration {
  comment?: { id: string; text: string; author: string; createdAt: number }[];
  note?: string;
  icon?: string;
  tags?: { text: string; color: string }[];
  task?: { title: string; status: 'todo' | 'in-progress' | 'done' };
  attachment?: { name: string; url: string; type: string };
  todo?: { checked: boolean; reminder?: TodoReminder };
  hyperlink?: { url: string; label?: string; mapId?: string };
  highlight?: string;
}

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
  /** 节点装饰（附加信息） */
  decorations?: NodeDecoration;
  /** 节点背景色 */
  bgColor?: string;
  /** 节点边框色 */
  borderColor?: string;
  /** 是否处于下钻状态的根节点 */
  isDrillRoot?: boolean;
}

/** 将纯文本安全转义为内联 HTML（保留换行） */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}

/** 节点状态机: normal → editing → normal */
type EditState = 'normal' | 'editing';

// ── 装饰图标配置 ──────────────────────────────────────────────
const DECORATION_ICONS: { key: keyof NodeDecoration; emoji: string; title: string }[] = [
  { key: 'comment', emoji: '💬', title: '评论' },
  { key: 'note', emoji: '📝', title: '注释' },
  { key: 'icon', emoji: '🎯', title: '图标' },
  { key: 'tags', emoji: '🏷️', title: '标签' },
  { key: 'task', emoji: '📋', title: '任务' },
  { key: 'attachment', emoji: '📎', title: '附件' },
  { key: 'todo', emoji: '☑️', title: '待办' },
  { key: 'hyperlink', emoji: '🔗', title: '超链接' },
];

export function MindNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as MindNodeData;
  const { updateNodeData, getNodes } = useReactFlow();
  const selectedNodeIds = useStore((state) => state.nodes.filter((n) => n.selected).map((n) => n.id));
  const allEdges = useEdges();
  const [editState, setEditState] = useState<EditState>('normal');
  const editorRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // 控制各气泡的弹出状态
  const [activePopover, setActivePopover] = useState<'comment' | 'note' | 'tags' | null>(null);
  const [hyperlinkEditToken, setHyperlinkEditToken] = useState(0);

  // 监听来自菜单的外部激活事件
  useEffect(() => {
    const handleEditDeco = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.nodeId === id) {
        if (detail.decorationType === 'hyperlink') {
          setHyperlinkEditToken((n) => n + 1);
          return;
        }
        setActivePopover(detail.decorationType as 'comment' | 'note' | 'tags');
      }
    };
    window.addEventListener('mindmap-edit-decoration', handleEditDeco);
    return () => window.removeEventListener('mindmap-edit-decoration', handleEditDeco);
  }, [id]);

  // 全局提取已用标签池
  const availableTags = useMemo(() => {
    const map = new Map();
    getNodes().forEach(n => {
      const tgs: { text: string, color: string }[] | undefined = (n.data as MindNodeData)?.decorations?.tags;
      tgs?.forEach(t => {
        if (!map.has(t.text)) map.set(t.text, { id: t.text, text: t.text, color: t.color });
      });
    });
    return Array.from(map.values());
  }, [getNodes, activePopover]); // 当气泡弹出或节点变化时重新计算


  // ── 图片全屏预览状态 ─────────────────────────────────────────
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImg, setIsDraggingImg] = useState(false);
  const isDraggingImgRef = useRef(false);
  const imgDragRef = useRef({ startX: 0, startY: 0, startOffX: 0, startOffY: 0 });

  // 计算该节点是否有子节点（层级连接）
  const hasChildren = useMemo(
    () => allEdges.some((e) => e.source === id && (e.type === 'hierarchyEdge' || !e.type)),
    [id, allEdges],
  );

  const collapsed = !!nodeData.collapsed;

  /** 当前节点应展示的 HTML（优先 html 字段，降级为转义后的纯文本） */
  const displayHtml = sanitizeHtml(nodeData.html ?? escapeHtml(nodeData.label));

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

  /** 提交编辑：保存 HTML + 提取纯文本 label。 */
  const commitEdit = useCallback(() => {
    if (!editorRef.current) return;
    const newHtml = sanitizeHtml(editorRef.current.innerHTML);
    const newLabel = (editorRef.current.innerText ?? '').trim() || nodeData.label;
    updateNodeData(id, { label: newLabel, html: newHtml });
    setEditState('normal');
  }, [id, nodeData.label, updateNodeData]);

  /** 进入编辑态 */
  const enterEdit = useCallback(() => {
    setEditState('editing');
  }, []);

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
          e.preventDefault();
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          document.execCommand('insertLineBreak', false);
          return;
        }
        e.preventDefault();
        commitEdit();
        return;
      }

      // Escape：保持内容提交并退出编辑
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
  const isDrillRoot = nodeData.isDrillRoot;
  const isDropTarget = nodeData.isDropTarget;
  const isLeftSide = nodeData.side === 'left';
  const targetPos = isLeftSide ? Position.Right : Position.Left;
  const sourcePos = isLeftSide ? Position.Left : Position.Right;

  // ── 装饰数据 ─────────────────────────────────────────────────
  const decorations = nodeData.decorations;
  const normalizedTags = useMemo(() => {
    const raw = decorations?.tags;
    if (!Array.isArray(raw)) return [] as { text: string; color: string }[];
    return raw.map((tag) => (typeof tag === 'string' ? { text: tag, color: '#3b82f6' } : tag));
  }, [decorations?.tags]);

  const hasTags = activePopover === 'tags' || normalizedTags.length > 0;
  const hasBottomDecorations = activePopover === 'comment' || activePopover === 'note' || (decorations && Object.keys(decorations).some((k) => {
    if (k === 'tags') return false;
    const val = decorations[k as keyof NodeDecoration];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }));

  // 高亮边框色（来自装饰或自定义）
  const highlightColor = decorations?.highlight;
  const customBorderColor = nodeData.borderColor || highlightColor;
  const customBgColor = nodeData.bgColor;
  const toolbarOwnerId = selectedNodeIds[0];
  const showToolbar = editState === 'editing' || (selected && toolbarOwnerId === id);

  return (
    <>
      {/* ── 富文本工具栏（NodeToolbar：选中或编辑时显示） ────────── */}
      <NodeToolbar
        isVisible={showToolbar}
        position={Position.Top}
        offset={12}
        align="center"
      >
        <RichTextToolbar
          editorRef={editorRef}
          isEditing={editState === 'editing'}
          onEnterEdit={enterEdit}
        />
      </NodeToolbar>

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
        onDoubleClick={handleDoubleClick}
        className={editState === 'editing' ? 'nodrag nopan' : undefined}
        style={{
          minWidth: isRoot ? 120 : 80,
          maxWidth: 300,
          minHeight: isRoot ? 36 : 28,
          padding: isRoot ? '8px 20px' : '6px 14px',
          borderRadius: isRoot ? 20 : 12,
          background: customBgColor
            ? customBgColor
            : isRoot
              ? 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #8b5cf6))'
              : 'rgba(26,26,46,0.95)',
          border: isDropTarget
            ? '2px solid #f59e0b'
            : customBorderColor
              ? `2px solid ${customBorderColor}`
              : selected
                ? '2px solid var(--primary)'
                : isRoot
                  ? '2px solid transparent'
                  : '1.5px solid rgba(255,255,255,0.12)',
          boxShadow: isDropTarget
            ? '0 0 0 4px rgba(245,158,11,0.25)'
            : highlightColor
              ? `0 0 0 3px ${highlightColor}40`
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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* 下钻返回按钮 */}
        {isDrillRoot && (
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              top: -28,
              left: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              background: 'rgba(99,102,241,0.2)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--primary)',
              border: '1px solid rgba(99,102,241,0.3)',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            title="返回上级"
            onClick={(e) => {
              e.stopPropagation();
              // drillUp 通过自定义事件通知 MapEditor
              window.dispatchEvent(new CustomEvent('mindmap-drill-up'));
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.35)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.2)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回上级
          </div>
        )}

        {/* 标签区：独立于底部装饰行，放在节点内容前方（利用内边距区域） */}
        {editState === 'normal' && hasTags && (
          <TagPopover
            open={activePopover === 'tags'}
            onOpenChange={(op) => setActivePopover(op ? 'tags' : null)}
            trigger={(
              <div
                className="nodrag nopan"
                style={{
                  alignSelf: 'flex-start',
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                  marginBottom: 4,
                  maxWidth: '100%',
                }}
              >
                {normalizedTags.length === 0 && activePopover === 'tags' && (
                  <span style={{ fontSize: 12, padding: '1px 3px', borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>🏷️</span>
                )}
                {normalizedTags.map((tag) => (
                  <span
                    key={tag.text}
                    style={{
                      backgroundColor: tag.color,
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    className="opacity-90 hover:opacity-100 hover:scale-105 transition-all shadow-sm"
                  >
                    {tag.text}
                  </span>
                ))}
              </div>
            )}
            nodeTags={normalizedTags.map((tag) => tag.text)}
            availableTags={availableTags}
            onAddTag={(text, color) => {
              const curr = [...normalizedTags];
              if (!curr.find((tag) => tag.text === text)) {
                updateNodeData(id, { decorations: { ...decorations, tags: [...curr, { text, color }] } });
              }
            }}
            onRemoveTag={(text) => {
              const next = normalizedTags.filter((tag) => tag.text !== text);
              updateNodeData(id, { decorations: { ...decorations, tags: next.length ? next : undefined } });
              if (!next.length) setActivePopover(null);
            }}
          />
        )}

        {/* 富文本编辑区 */}
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

        {/* 装饰行（在节点下方或内部） */}
        {hasBottomDecorations && editState === 'normal' && (
          <div
            className="nodrag nopan"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {DECORATION_ICONS.map(({ key, emoji, title }) => {
              if (key === 'tags') return null;

              const val = decorations?.[key as keyof NodeDecoration];
              if (activePopover !== key) {
                if (val === undefined || val === null || val === '') return null;
                if (Array.isArray(val) && val.length === 0) return null;
              }

              // 对不同类型的装饰图标定义触发元素
              let iconElement: React.ReactNode = null;

              if (key === 'todo') {
                const todoData = (val as { checked: boolean; reminder?: any }) || { checked: false };
                iconElement = (
                  <TodoCheckbox
                    checked={!!todoData.checked}
                    reminder={todoData.reminder}
                    compact
                    onToggle={() => {
                      updateNodeData(id, { decorations: { ...decorations, todo: { ...todoData, checked: !todoData.checked } } });
                    }}
                    onRemove={() => {
                      const next = { ...decorations };
                      delete next.todo;
                      updateNodeData(id, { decorations: next });
                    }}
                    onSetReminder={(reminder) => {
                      updateNodeData(id, { decorations: { ...decorations, todo: { ...todoData, reminder } } });
                    }}
                    onRemoveReminder={() => {
                      const { reminder: _r, ...rest } = todoData;
                      updateNodeData(id, { decorations: { ...decorations, todo: rest } });
                    }}
                  />
                );
              } else if (key === 'hyperlink') {
                const hyperlinkData = (val as { url: string; label?: string; mapId?: string }) || { url: '' };
                iconElement = (
                  <HyperlinkBadge
                    hyperlink={hyperlinkData}
                    requestEditToken={hyperlinkEditToken}
                    compact
                    onSave={(next) => {
                      updateNodeData(id, { decorations: { ...decorations, hyperlink: next } });
                    }}
                    onRemove={() => {
                      const next = { ...decorations };
                      delete next.hyperlink;
                      updateNodeData(id, { decorations: next });
                    }}
                  />
                );
              } else {
                let comments = (decorations!.comment as any) || [];
                // 兼容旧的 string 数据
                if (typeof comments === 'string') {
                  comments = [{ id: Date.now().toString(), text: comments, author: '我', createdAt: Date.now() }];
                } else if (!Array.isArray(comments)) {
                  comments = [];
                }

                let displayTitle = title;
                if (key === 'comment' && comments.length > 0) {
                  displayTitle = `评论 (${comments.length})`;
                }

                const hasCustomTooltip = key === 'comment' || key === 'note';

                iconElement = (
                  <span
                    title={hasCustomTooltip ? undefined : displayTitle}
                    className="group relative"
                    style={{
                      fontSize: 12,
                      cursor: 'pointer',
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.08)',
                      transition: 'background 0.12s',
                      lineHeight: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // 对受支持的高级类型，直接由当前节点挂载的 Popover 处理
                      if (['comment', 'note', 'tags'].includes(key)) {
                        setActivePopover(key as 'comment' | 'note' | 'tags');
                      } else {
                        // 其他暂未高级重构的类型，可通过原事件派发
                        window.dispatchEvent(new CustomEvent('mindmap-edit-decoration', {
                          detail: { nodeId: id, decorationType: key },
                        }));
                      }
                    }}
                  >
                    {emoji}
                    {key === 'comment' && comments.length > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 12,
                          height: 12,
                          borderRadius: 999,
                          background: 'var(--primary)',
                          color: '#fff',
                          fontSize: 9,
                          lineHeight: '12px',
                          textAlign: 'center',
                          padding: '0 2px',
                        }}
                      >
                        {comments.length > 9 ? '9+' : comments.length}
                      </span>
                    )}

                    {/* CUSTOM TOOLTIP CONTENT */}
                    {key === 'comment' && comments.length > 0 && (
                      <div className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-[280px] bg-white rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] text-left cursor-default flex flex-col gap-2">
                        {comments.map((c: any, i: number) => (
                          <div key={i} className="flex flex-col gap-1 text-sm border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                            <div className="flex justify-between items-center text-xs text-gray-400">
                              <span className="font-medium text-gray-600 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
                                {c.author}
                              </span>
                              <span>{new Date(c.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </div>
                            <div className="text-gray-700 leading-snug whitespace-pre-wrap">{c.text}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {key === 'note' && typeof decorations!.note === 'string' && decorations!.note.trim().length > 0 && (
                      <div className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 w-[350px] bg-white rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-100 p-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] text-left overflow-hidden">
                        <div
                          className="text-sm text-gray-700 font-normal leading-relaxed overflow-hidden"
                          style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(decorations!.note || '') }}
                        />
                      </div>
                    )}
                  </span>
                );
              }

              return (
                <div
                  key={key}
                  className="relative"
                  style={{
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {/* 根据类型包裹对应的 Popover */}
                  {key === 'comment' ? (
                    <CommentPopover
                      open={activePopover === 'comment'}
                      onOpenChange={(op) => setActivePopover(op ? 'comment' : null)}
                      trigger={iconElement}
                      comments={typeof decorations!.comment === 'string'
                        ? [{ id: Date.now().toString(), text: decorations!.comment, author: '我', createdAt: Date.now() }]
                        : Array.isArray(decorations!.comment) ? decorations!.comment : []}
                      onAdd={(text) => {
                        const currentComments = typeof decorations!.comment === 'string'
                          ? [{ id: Date.now().toString(), text: decorations!.comment, author: '我', createdAt: Date.now() }]
                          : Array.isArray(decorations!.comment) ? decorations!.comment : [];
                        const newComment = { id: Date.now().toString(), text, author: session?.user?.name || session?.user?.email?.split('@')[0] || '我', createdAt: Date.now() };
                        updateNodeData(id, { decorations: { ...decorations, comment: [...currentComments, newComment] } });
                      }}
                      onUpdate={(cid, text) => {
                        const currentComments = typeof decorations!.comment === 'string'
                          ? [{ id: Date.now().toString(), text: decorations!.comment, author: '我', createdAt: Date.now() }]
                          : Array.isArray(decorations!.comment) ? decorations!.comment : [];
                        updateNodeData(id, { decorations: { ...decorations, comment: currentComments.map(c => c.id === cid ? { ...c, text } : c) } });
                      }}
                      onDelete={(cid) => {
                        const currentComments = typeof decorations!.comment === 'string'
                          ? [{ id: Date.now().toString(), text: decorations!.comment, author: '我', createdAt: Date.now() }]
                          : Array.isArray(decorations!.comment) ? decorations!.comment : [];
                        const next = currentComments.filter(c => c.id !== cid);
                        updateNodeData(id, { decorations: { ...decorations, comment: next.length ? next : undefined } });
                        if (!next.length) setActivePopover(null);
                      }}
                    />
                  ) : key === 'todo' ? (
                    // TodoCheckbox 自管理所有交互，不需要 Popover 包裹
                    iconElement
                  ) : key === 'note' ? (
                    <NotePopover
                      open={activePopover === 'note'}
                      onOpenChange={(op) => setActivePopover(op ? 'note' : null)}
                      trigger={iconElement}
                      note={decorations!.note || ''}
                      onSave={(html) => {
                        updateNodeData(id, { decorations: { ...decorations, note: sanitizeHtml(html) } });
                      }}
                    />
                  ) : iconElement}
                </div>
              );
            })}
          </div>
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

      {/* 图片全屏预览 Portal */}
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
    pd.collapsed === nd.collapsed &&
    pd.bgColor === nd.bgColor &&
    pd.borderColor === nd.borderColor &&
    pd.isDrillRoot === nd.isDrillRoot &&
    pd.decorations === nd.decorations
  );
});