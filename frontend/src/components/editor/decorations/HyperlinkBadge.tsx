import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface HyperlinkData {
  url: string;
  label?: string;
  mapId?: string;
}

interface HyperlinkBadgeProps {
  hyperlink: HyperlinkData;
  requestEditToken?: number;
  compact?: boolean;
  onSave: (next: HyperlinkData) => void;
  onRemove: () => void;
}

function normalizeUrl(input: string) {
  const text = input.trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function getDisplayLabel(hyperlink: HyperlinkData) {
  if (hyperlink.label?.trim()) return hyperlink.label.trim();
  if (hyperlink.url?.trim()) return hyperlink.url.trim();
  return '链接';
}

export function HyperlinkBadge({ hyperlink, requestEditToken = 0, compact = false, onSave, onRemove }: HyperlinkBadgeProps) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [url, setUrl] = useState(hyperlink.url || '');
  const [label, setLabel] = useState(hyperlink.label || '');
  const [error, setError] = useState('');
  const ctxRef = useRef<HTMLDivElement>(null);

  const displayLabel = useMemo(() => getDisplayLabel(hyperlink), [hyperlink]);

  useEffect(() => {
    setUrl(hyperlink.url || '');
    setLabel(hyperlink.label || '');
  }, [hyperlink]);

  useEffect(() => {
    if (!requestEditToken) return;
    setUrl(hyperlink.url || '');
    setLabel(hyperlink.label || '');
    setError('');
    setShowEditor(true);
  }, [requestEditToken, hyperlink]);

  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ctxMenu]);

  const openEditor = () => {
    setUrl(hyperlink.url || '');
    setLabel(hyperlink.label || '');
    setError('');
    setShowEditor(true);
    setCtxMenu(null);
  };

  const handleSave = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('请输入链接地址');
      return;
    }
    onSave({ ...hyperlink, url: normalized, label: label.trim() || undefined });
    setShowEditor(false);
    setCtxMenu(null);
  };

  const handleOpenLink = () => {
    const href = hyperlink.url?.trim();
    if (!href) {
      openEditor();
      return;
    }
    window.open(normalizeUrl(href), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <span
        className="nodrag nopan"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenLink();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
        style={{
          position: 'relative',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? 22 : undefined,
          height: compact ? 22 : undefined,
          gap: compact ? 0 : 4,
          padding: compact ? 0 : '2px 6px',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.08)',
          transition: 'background 0.12s',
          fontSize: 12,
          lineHeight: 1,
          maxWidth: compact ? undefined : 180,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
        }}
        title={hyperlink.url || '超链接（右键编辑）'}
      >
        <span>🔗</span>
        {!compact && (
          <span
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 140,
            }}
          >
            {displayLabel}
          </span>
        )}
      </span>

      {ctxMenu &&
        createPortal(
          <div
            ref={ctxRef}
            style={{
              position: 'fixed',
              left: ctxMenu.x,
              top: ctxMenu.y,
              background: 'rgba(20,20,36,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '4px 0',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 9999,
              minWidth: 170,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={menuBtnStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              onClick={openEditor}
            >
              <span style={{ fontSize: 13 }}>✏️</span>
              <span>编辑超链接</span>
            </button>
            <button
              style={{ ...menuBtnStyle, color: '#f87171' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              onClick={() => {
                onRemove();
                setCtxMenu(null);
              }}
            >
              <span style={{ fontSize: 13 }}>🗑️</span>
              <span>移除超链接</span>
            </button>
          </div>,
          document.body,
        )}

      {showEditor &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
            }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowEditor(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 24,
                width: 460,
                boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 font-semibold text-gray-800">
                  <span className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center text-lg">🔗</span>
                  编辑超链接
                </div>
                <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className={labelCls}>链接：</span>
                  <input
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="https://example.com"
                    className={inputCls}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className={labelCls}>文字：</span>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="可选，不填则显示链接地址"
                    className={inputCls}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>

                {error && <div className="text-sm text-red-500 pl-[68px]">{error}</div>}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 rounded-md text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-md text-sm text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

const menuBtnStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  color: '#e5e7eb',
  fontSize: 13,
  padding: '7px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  textAlign: 'left',
};

const inputCls =
  'w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary';
const labelCls = 'text-sm text-gray-500 w-14 shrink-0 text-right';
