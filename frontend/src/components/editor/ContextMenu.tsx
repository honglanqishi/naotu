'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
  /** 右侧显示的快捷键提示文字，如 "Ctrl+C" */
  shortcut?: string;
  /** 是否禁用该菜单项 */
  disabled?: boolean;
  /** 子菜单（hover 展开） */
  children?: ContextMenuAction[];
}

interface ContextMenuProps {
  /** 屏幕坐标（px） */
  x: number;
  y: number;
  /** 菜单项列表 */
  actions: ContextMenuAction[];
  /** 关闭回调 */
  onClose: () => void;
}

// ── 子菜单项组件（支持 hover 展开子菜单） ─────────────────────────
function MenuItem({
  action,
  onClose,
  parentRight,
  parentTop,
}: {
  action: ContextMenuAction;
  onClose: () => void;
  parentRight: number;
  parentTop: number;
}) {
  const [showSub, setShowSub] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const hasChildren = action.children && action.children.length > 0;

  const clearCloseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCloseTimer = useCallback(() => {
    if (hasChildren) {
      timerRef.current = setTimeout(() => setShowSub(false), 200);
    }
  }, [hasChildren]);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    if (hasChildren) setShowSub(true);
  }, [hasChildren, clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    startCloseTimer();
  }, [startCloseTimer]);

  // 计算子菜单位置
  const getSubMenuPos = useCallback(() => {
    if (!itemRef.current) return { x: parentRight, y: parentTop };
    const rect = itemRef.current.getBoundingClientRect();
    const subWidth = 180;
    // 默认在右侧展开；如果右边空间不够，改到左侧
    const x = rect.right + subWidth > window.innerWidth
      ? rect.left - subWidth
      : rect.right;
    // Y 坐标对齐当前菜单项顶部
    const y = rect.top;
    return { x, y };
  }, [parentRight, parentTop]);

  return (
    <div ref={itemRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        disabled={action.disabled}
        onClick={() => {
          if (action.disabled || hasChildren) return;
          action.onClick?.();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 14px',
          background: 'transparent',
          border: 'none',
          cursor: action.disabled ? 'not-allowed' : hasChildren ? 'default' : 'pointer',
          fontSize: 13,
          color: action.disabled
            ? 'rgba(255,255,255,0.25)'
            : action.danger
              ? '#f87171'
              : 'var(--foreground)',
          textAlign: 'left',
          transition: 'background 0.1s',
          opacity: action.disabled ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (action.disabled) return;
          (e.currentTarget as HTMLButtonElement).style.background = action.danger
            ? 'rgba(248,113,113,0.1)'
            : 'rgba(255,255,255,0.06)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        {action.icon && (
          <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {action.icon}
          </span>
        )}
        <span style={{ flex: 1 }}>{action.label}</span>
        {action.shortcut && (
          <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 4, flexShrink: 0 }}>
            {action.shortcut}
          </span>
        )}
        {hasChildren && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ opacity: 0.5, flexShrink: 0 }}
          >
            <path d="M8 5l8 7-8 7z" />
          </svg>
        )}
      </button>

      {action.dividerAfter && (
        <div
          style={{
            height: 1,
            margin: '4px 10px',
            background: 'rgba(255,255,255,0.08)',
          }}
        />
      )}

      {/* 子菜单 */}
      {hasChildren && showSub && typeof document !== 'undefined' && createPortal(
        <SubMenu
          actions={action.children!}
          position={getSubMenuPos()}
          onClose={onClose}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={startCloseTimer}
        />,
        document.body
      )}
    </div>
  );
}

// ── 子菜单容器 ───────────────────────────────────────────────
function SubMenu({
  actions,
  position,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  actions: ContextMenuAction[];
  position: { x: number; y: number };
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const menuWidth = 180;
  const menuItemH = 34;
  const estimatedH = actions.length * menuItemH + 16;
  const adjustedX =
    position.x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : position.x;
  const adjustedY =
    position.y + estimatedH > window.innerHeight ? window.innerHeight - estimatedH - 8 : position.y;

  return (
    <div
      data-context-submenu="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
        width: menuWidth,
        background: 'rgba(20,20,36,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        padding: '6px 0',
        overflow: 'hidden',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, idx) => (
        <MenuItem
          key={idx}
          action={action}
          onClose={onClose}
          parentRight={adjustedX + menuWidth}
          parentTop={adjustedY}
        />
      ))}
    </div>
  );
}

/** 右键自定义菜单（固定定位，点击外部或 Escape 关闭，支持子菜单嵌套） */
export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // 如果点击在子菜单上也不应关闭，通过 fixed 嵌套解决
        // 检查是否点击在任何子菜单上
        const target = e.target as HTMLElement;
        if (target.closest('[data-context-submenu]')) return;
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // 延迟注册，避免触发当前右键事件的冒泡
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 边界检测：防止菜单超出视口
  const menuWidth = 180;
  const menuItemH = 34;
  const estimatedH = actions.length * menuItemH + 16;
  const adjustedX =
    x + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : x;
  const adjustedY =
    y + estimatedH > window.innerHeight ? window.innerHeight - estimatedH - 8 : y;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9999,
        width: menuWidth,
        background: 'rgba(20,20,36,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        padding: '6px 0',
        overflow: 'visible', // allow sub-menus to overflow
      }}
      // 阻止内部右键再次弹出
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, idx) => (
        <MenuItem
          key={idx}
          action={action}
          onClose={onClose}
          parentRight={adjustedX + menuWidth}
          parentTop={adjustedY}
        />
      ))}
    </div>
  );
}
