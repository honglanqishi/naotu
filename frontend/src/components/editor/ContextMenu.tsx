'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  dividerAfter?: boolean;
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

/** 右键自定义菜单（固定定位，点击外部或 Escape 关闭） */
export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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
        overflow: 'hidden',
      }}
      // 阻止内部右键再次弹出
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action, idx) => (
        <div key={idx}>
          <button
            onClick={() => {
              action.onClick();
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
              cursor: 'pointer',
              fontSize: 13,
              color: action.danger ? '#f87171' : 'var(--foreground)',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = action.danger
                ? 'rgba(248,113,113,0.1)'
                : 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            {action.icon && (
              <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                {action.icon}
              </span>
            )}
            {action.label}
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
        </div>
      ))}
    </div>
  );
}
