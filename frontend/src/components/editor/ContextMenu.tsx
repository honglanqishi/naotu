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
// 菜单项基础样式
const menuItemBaseStyle = "flex items-center gap-2 w-full px-3.5 py-1.75 bg-transparent border-none cursor-pointer text-left transition-colors duration-100";
const menuItemDisabledStyle = "cursor-not-allowed opacity-50";
const menuItemDangerStyle = "text-red-400";

// 子菜单容器样式
const subMenuContainerClass = "fixed z-[10000] w-[180px] bg-[rgba(20,20,36,0.97)] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl p-1.5 overflow-hidden";

// 主菜单容器样式
const menuContainerClass = "fixed z-[9999] w-[180px] bg-[rgba(20,20,36,0.97)] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl p-1.5 overflow-visible";

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
        className={`${menuItemBaseStyle} ${action.disabled ? menuItemDisabledStyle : ''} ${action.danger ? menuItemDangerStyle : 'text-[var(--foreground)]'}`}
        onClick={() => {
          if (action.disabled || hasChildren) return;
          action.onClick?.();
          onClose();
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
          <span className="opacity-70 flex items-center shrink-0">
            {action.icon}
          </span>
        )}
        <span className="flex-1 text-[13px]">{action.label}</span>
        {action.shortcut && (
          <span className="text-[11px] opacity-45 ml-1 shrink-0">
            {action.shortcut}
          </span>
        )}
        {hasChildren && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="opacity-50 shrink-0"
          >
            <path d="M8 5l8 7-8 7z" />
          </svg>
        )}
      </button>

      {action.dividerAfter && (
        <div className="h-px my-1 mx-2.5 bg-white/8" />
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
      className={subMenuContainerClass}
      style={{ left: adjustedX, top: adjustedY }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
      className={menuContainerClass}
      style={{ left: adjustedX, top: adjustedY }}
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
