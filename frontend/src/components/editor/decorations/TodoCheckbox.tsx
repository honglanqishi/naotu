import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TodoReminder } from '../nodes/MindNode';

// ── 提醒时间选项 ──────────────────────────────────────────────
const REMIND_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'before_5m', label: '开始前5分钟' },
    { value: 'before_10m', label: '开始前10分钟' },
    { value: 'before_15m', label: '开始前15分钟' },
    { value: 'before_30m', label: '开始前30分钟' },
    { value: 'before_1h', label: '开始前1小时' },
    { value: 'before_2h', label: '开始前2小时' },
    { value: 'before_3h', label: '开始前3小时' },
    { value: 'before_4h', label: '开始前4小时' },
    { value: 'before_5h', label: '开始前5小时' },
    { value: 'before_6h', label: '开始前6小时' },
    { value: 'before_7h', label: '开始前7小时' },
    { value: 'before_8h', label: '开始前8小时' },
    { value: 'before_9h', label: '开始前9小时' },
    { value: 'before_10h', label: '开始前10小时' },
    { value: 'before_11h', label: '开始前11小时' },
    { value: 'before_12h', label: '开始前12小时' },
    { value: 'before_0_5d', label: '开始前0.5天' },
    { value: 'before_18h', label: '开始前18小时' },
    { value: 'before_1d', label: '开始前1天' },
    { value: 'before_2d', label: '开始前2天' },
    { value: 'before_3d', label: '开始前3天' },
    { value: 'before_4d', label: '开始前4天' },
    { value: 'before_1w', label: '开始前1周' },
    { value: 'before_2w', label: '开始前2周' },
    { value: 'none', label: '不提醒' },
];

function getRemindLabel(value: string) {
    return REMIND_OPTIONS.find((opt) => opt.value === value)?.label || value;
}

interface TodoCheckboxProps {
    checked: boolean;
    reminder?: TodoReminder;
    onToggle: () => void;
    onRemove: () => void;
    onSetReminder: (reminder: TodoReminder) => void;
    onRemoveReminder: () => void;
}

/** 获取当天和默认时间 */
function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TodoCheckbox({
    checked,
    reminder,
    onToggle,
    onRemove,
    onSetReminder,
    onRemoveReminder,
}: TodoCheckboxProps) {
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const [showReminder, setShowReminder] = useState(false);
    const ctxRef = useRef<HTMLDivElement>(null);

    // 提醒表单状态
    const [email, setEmail] = useState(reminder?.email || '');
    const [title, setTitle] = useState(reminder?.title || '');
    const [startDate, setStartDate] = useState(reminder?.startDate || getToday());
    const [startTime, setStartTime] = useState(reminder?.startTime || '08:00');
    const [endDate, setEndDate] = useState(reminder?.endDate || getToday());
    const [endTime, setEndTime] = useState(reminder?.endTime || '16:00');
    const [remind, setRemind] = useState(reminder?.remind || 'before_15m');
    const [notes, setNotes] = useState(reminder?.notes || '');
    const [showRemindDropdown, setShowRemindDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭提醒下拉框
    useEffect(() => {
        if (!showRemindDropdown) return;
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowRemindDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showRemindDropdown]);

    // 当 reminder prop 改变时同步表单
    useEffect(() => {
        if (reminder) {
            setEmail(reminder.email);
            setTitle(reminder.title);
            setStartDate(reminder.startDate);
            setStartTime(reminder.startTime);
            setEndDate(reminder.endDate);
            setEndTime(reminder.endTime);
            setRemind(reminder.remind);
            setNotes(reminder.notes || '');
        }
    }, [reminder]);

    // 点击外部关闭右键菜单
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

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY });
    }, []);

    const handleCreateReminder = useCallback(() => {
        if (!email.trim()) {
            alert('请输入邮箱地址');
            return;
        }
        onSetReminder({
            email: email.trim(),
            title: title.trim() || '待办提醒',
            startDate,
            startTime,
            endDate,
            endTime,
            remind,
            notes: notes.trim() || undefined,
        });
        setShowReminder(false);
        setCtxMenu(null);
    }, [email, title, startDate, startTime, endDate, endTime, remind, notes, onSetReminder]);

    const inputCls = "w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary";
    const labelCls = "text-sm text-gray-500 w-14 shrink-0 text-right";

    return (
        <>
            {/* 选框 */}
            <span
                className="nodrag nopan"
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                onContextMenu={handleContextMenu}
                style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 4px',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.08)',
                    transition: 'background 0.12s',
                    fontSize: 14,
                    lineHeight: 1,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                title={reminder ? `提醒: ${getRemindLabel(remind)}\n邮箱: ${reminder.email}` : '待办 (右键设置提醒)'}
            >
                {checked ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" fill="#22c55e" />
                        <polyline points="7 12 10 15 17 8" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" fill="rgba(255,255,255,0.1)" />
                    </svg>
                )}
                {reminder && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" style={{ marginLeft: -2 }}>
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                )}
            </span>

            {/* 右键菜单 */}
            {ctxMenu && createPortal(
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
                        minWidth: 160,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        style={menuBtnStyle}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        onClick={() => { setShowReminder(true); setCtxMenu(null); }}
                    >
                        <span style={{ fontSize: 13 }}>🔔</span>
                        <span>{reminder ? '编辑邮件提醒' : '添加邮件提醒'}</span>
                    </button>
                    {reminder && (
                        <button
                            style={{ ...menuBtnStyle, color: '#f87171' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            onClick={() => { onRemoveReminder(); setCtxMenu(null); }}
                        >
                            <span style={{ fontSize: 13 }}>🗑️</span>
                            <span>移除提醒</span>
                        </button>
                    )}
                    <div style={{ height: 1, margin: '4px 10px', background: 'rgba(255,255,255,0.08)' }} />
                    <button
                        style={{ ...menuBtnStyle, color: '#f87171' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        onClick={() => { onRemove(); setCtxMenu(null); }}
                    >
                        <span style={{ fontSize: 13 }}>❌</span>
                        <span>移除待办</span>
                    </button>
                </div>,
                document.body
            )}

            {/* 提醒弹窗 */}
            {showReminder && createPortal(
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.35)',
                    }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setShowReminder(false); }}
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
                        {/* Header */}
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2 font-semibold text-gray-800">
                                <span className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center text-lg">🔔</span>
                                新建提醒
                            </div>
                            <button
                                onClick={() => setShowReminder(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >✕</button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* 类型 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>类型：</span>
                                <div className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-600 bg-gray-50">
                                    邮件提醒
                                </div>
                            </div>

                            {/* 邮箱 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>邮箱：</span>
                                <input
                                    type="email"
                                    placeholder="输入接收提醒的邮箱地址"
                                    className={inputCls + ' flex-1'}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            {/* 标题 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>标题：</span>
                                <input
                                    type="text"
                                    placeholder="添加标题"
                                    className={inputCls + ' flex-1'}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            {/* 开始 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>开始：</span>
                                <input type="date" className={inputCls + ' flex-1'} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <input type="time" className={inputCls + ' w-24'} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                            </div>

                            {/* 完成 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>完成：</span>
                                <input type="date" className={inputCls + ' flex-1'} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                <input type="time" className={inputCls + ' w-24'} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                            </div>

                            {/* 提示 */}
                            <div className="flex items-center gap-3 relative">
                                <span className={labelCls}>提示：</span>
                                <div className="flex-1 relative" ref={dropdownRef}>
                                    <button
                                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-800 text-left flex items-center justify-between bg-white hover:border-gray-400 transition-colors"
                                        onClick={() => setShowRemindDropdown(!showRemindDropdown)}
                                    >
                                        <span>{getRemindLabel(remind)}</span>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}><path d="M7 10l5 5 5-5z" /></svg>
                                    </button>
                                    {showRemindDropdown && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-[240px] overflow-y-auto">
                                            {REMIND_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${remind === opt.value ? 'text-primary font-medium bg-primary/5' : 'text-gray-700'}`}
                                                    onClick={() => {
                                                        setRemind(opt.value);
                                                        setShowRemindDropdown(false);
                                                    }}
                                                >
                                                    {remind === opt.value && <span className="text-primary">✓</span>}
                                                    <span className={remind === opt.value ? '' : 'ml-5'}>{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 备注 */}
                            <div className="flex items-center gap-3">
                                <span className={labelCls}>备注：</span>
                                <input
                                    type="text"
                                    placeholder="添加描述"
                                    className={inputCls + ' flex-1'}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowReminder(false)}
                                className="px-4 py-1.5 border border-gray-200 rounded text-sm text-gray-600 hover:bg-gray-50"
                            >取消</button>
                            <button
                                onClick={handleCreateReminder}
                                className="px-5 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary/90 font-medium"
                            >创建</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

const menuBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'left',
    transition: 'background 0.1s',
};
