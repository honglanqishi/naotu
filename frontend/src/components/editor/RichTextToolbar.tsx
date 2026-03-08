'use client';

import { useCallback, useRef, useState, useEffect } from 'react';

interface RichTextToolbarProps {
    /** contentEditable 元素的 ref */
    editorRef: React.RefObject<HTMLDivElement | null>;
    /** 是否处于编辑态（决定格式化按钮是否可用） */
    isEditing: boolean;
    /** 回调：将编辑区设为编辑态（单击选中时，先进入编辑才能格式化） */
    onEnterEdit?: () => void;
    /** 主题：dark（深色浮动栏）或 light（浅色平铺栏） */
    theme?: 'dark' | 'light';
}

// ── 颜色预设 ──────────────────────────────────────────────────
const TEXT_COLORS = [
    '#ffffff', '#f87171', '#fb923c', '#facc15', '#4ade80',
    '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8', '#000000',
];

const BG_COLORS = [
    'transparent', '#991b1b', '#9a3412', '#854d0e', '#166534',
    '#1e40af', '#5b21b6', '#9d174d', '#1e293b', '#374151',
];

const FONT_SIZES = ['1', '2', '3', '4', '5', '6', '7'];

/** 富文本浮动工具栏 — 用于 NodeToolbar 内部 */
export function RichTextToolbar({ editorRef, isEditing, onEnterEdit, theme = 'dark' }: RichTextToolbarProps) {
    const isLight = theme === 'light';
    const [showColorPicker, setShowColorPicker] = useState<'text' | 'bg' | null>(null);
    const [showFontSize, setShowFontSize] = useState(false);
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tableHover, setTableHover] = useState({ row: 0, col: 0 });
    const colorRef = useRef<HTMLDivElement>(null);
    const fontSizeRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    // 格式激活状态跟踪
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikeThrough: false,
        insertUnorderedList: false,
        insertOrderedList: false,
        justifyLeft: false,
        justifyCenter: false,
        justifyRight: false,
        subscript: false,
        superscript: false,
    });

    const getFormatsFromDOM = useCallback(() => {
        try {
            return {
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strikeThrough: document.queryCommandState('strikeThrough'),
                insertUnorderedList: document.queryCommandState('insertUnorderedList'),
                insertOrderedList: document.queryCommandState('insertOrderedList'),
                justifyLeft: document.queryCommandState('justifyLeft'),
                justifyCenter: document.queryCommandState('justifyCenter'),
                justifyRight: document.queryCommandState('justifyRight'),
                subscript: document.queryCommandState('subscript'),
                superscript: document.queryCommandState('superscript'),
            };
        } catch {
            return null;
        }
    }, []);

    const updateActiveFormats = useCallback(() => {
        const formats = getFormatsFromDOM();
        if (formats) {
            setActiveFormats(formats);
        }
    }, [getFormatsFromDOM]);

    const forceUpdateFormatsForNode = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;

        const originalEditable = el.contentEditable;
        el.contentEditable = 'true';

        const sel = window.getSelection();
        const savedRanges: Range[] = [];
        if (sel) {
            for (let i = 0; i < sel.rangeCount; i++) {
                savedRanges.push(sel.getRangeAt(i));
            }
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        const formats = getFormatsFromDOM();
        if (formats) {
            setActiveFormats(formats);
        }

        if (sel) {
            sel.removeAllRanges();
            savedRanges.forEach(r => sel.addRange(r));
        }
        el.contentEditable = originalEditable;
    }, [editorRef, getFormatsFromDOM]);

    // 监听选区变化，仅编辑态有效
    useEffect(() => {
        const handleSelectionChange = () => {
            if (isEditing) {
                updateActiveFormats();
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [isEditing, updateActiveFormats]);

    // 状态切换或初次展示时，更新格式状态
    useEffect(() => {
        if (!isEditing) {
            forceUpdateFormatsForNode();
        } else {
            updateActiveFormats();
        }
    }, [isEditing, forceUpdateFormatsForNode, updateActiveFormats]);

    // 点击外部关闭下拉
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
                setShowColorPicker(null);
            }
            if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) {
                setShowFontSize(false);
            }
            if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
                setShowTablePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    /** 执行格式化命令（自动聚焦编辑区） */
    const exec = useCallback(
        (command: string, value?: string) => {
            if (!isEditing && onEnterEdit) {
                onEnterEdit();
                // 等 contentEditable 变为 true 后再执行命令
                requestAnimationFrame(() => {
                    editorRef.current?.focus();
                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand(command, false, value);
                    updateActiveFormats();
                });
                return;
            }
            editorRef.current?.focus();
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand(command, false, value);
            updateActiveFormats();
        },
        [editorRef, isEditing, onEnterEdit, updateActiveFormats],
    );

    /** 插入 HTML 片段 */
    const insertHTML = useCallback(
        (html: string) => {
            if (!isEditing && onEnterEdit) {
                onEnterEdit();
                requestAnimationFrame(() => {
                    editorRef.current?.focus();
                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand('insertHTML', false, html);
                });
                return;
            }
            editorRef.current?.focus();
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            document.execCommand('insertHTML', false, html);
        },
        [editorRef, isEditing, onEnterEdit],
    );

    const btnStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: isLight ? '#4b5563' : 'rgba(255,255,255,0.85)',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        transition: 'background 0.12s, color 0.12s',
        flexShrink: 0,
    };

    const activeBtnStyle: React.CSSProperties = {
        ...btnStyle,
        background: isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.35)',
        color: isLight ? '#4f46e5' : '#a5b4fc',
    };

    /** 根据激活状态返回按钮样式 */
    const getBtnStyle = (format: keyof typeof activeFormats): React.CSSProperties =>
        activeFormats[format] ? activeBtnStyle : btnStyle;

    const hoverBg = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.1)';
    const activeHoverBg = isLight ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.55)';
    const activeRestBg = isLight ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.35)';

    const onHover = (e: React.MouseEvent, active?: boolean) => {
        (e.target as HTMLElement).style.background = active ? activeHoverBg : hoverBg;
    };
    const onLeave = (e: React.MouseEvent, active?: boolean) => {
        (e.target as HTMLElement).style.background = active ? activeRestBg : 'transparent';
    };

    const dividerStyle: React.CSSProperties = {
        width: 1,
        height: 18,
        background: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)',
        margin: '0 4px',
        flexShrink: 0,
    };

    const dropdownStyle: React.CSSProperties = {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 6,
        background: isLight ? 'white' : 'rgba(20,20,36,0.97)',
        border: isLight ? '1px solid #e5e7eb' : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 8,
        boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.12)' : '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 10,
    };

    /** 插入链接 */
    const handleInsertLink = () => {
        const url = prompt('请输入链接地址：', 'https://');
        if (url) {
            const text = window.getSelection()?.toString() || url;
            insertHTML(`<a href="${url}" target="_blank" rel="noopener" style="color:#3b82f6;text-decoration:underline">${text}</a>`);
        }
    };

    /** 插入图片 */
    const handleInsertImage = () => {
        const url = prompt('请输入图片地址：', 'https://');
        if (url) {
            insertHTML(`<img src="${url}" style="max-width:100%;border-radius:4px;margin:4px 0" />`);
        }
    };

    /** 插入表格 */
    const handleInsertTable = (rows: number, cols: number) => {
        let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px">';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                const tag = r === 0 ? 'th' : 'td';
                const style = 'border:1px solid #d1d5db;padding:6px 10px;text-align:left;' + (r === 0 ? 'background:#f3f4f6;font-weight:600' : '');
                html += `<${tag} style="${style}">${r === 0 ? `列${c + 1}` : '&nbsp;'}</${tag}>`;
            }
            html += '</tr>';
        }
        html += '</table><p><br></p>';
        insertHTML(html);
        setShowTablePicker(false);
    };

    /** 插入引用块 */
    const handleBlockquote = () => {
        insertHTML('<blockquote style="border-left:3px solid #6366f1;padding:4px 12px;margin:8px 0;color:#6b7280;background:#f5f3ff;border-radius:0 4px 4px 0">引用内容</blockquote><p><br></p>');
    };

    /** 插入代码块 */
    const handleCodeBlock = () => {
        insertHTML('<pre style="background:#1e1e2e;color:#a6e3a1;padding:12px 16px;border-radius:8px;margin:8px 0;font-family:Consolas,Monaco,monospace;font-size:13px;overflow-x:auto;white-space:pre"><code>// 在此输入代码</code></pre><p><br></p>');
    };

    /** 插入分割线 */
    const handleHorizontalRule = () => {
        exec('insertHorizontalRule');
    };

    return (
        <div
            className="nodrag nopan nowheel"
            tabIndex={-1}  // 禁止键盘 Tab 聚焦到工具栏容器，防止焦点逃出画布
            onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }} // 二次防御
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '4px 8px',
                background: isLight ? 'transparent' : 'rgba(20,20,36,0.97)',
                border: isLight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                boxShadow: isLight ? 'none' : '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
                backdropFilter: isLight ? 'none' : 'blur(12px)',
                whiteSpace: 'nowrap',
                position: 'relative',
                flexWrap: isLight ? 'wrap' : 'nowrap',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* ── 撤销 / 重做 ── */}
            <button style={btnStyle} title="撤销 (Ctrl+Z)"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('undo')}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h14a4 4 0 110 8H11" /><path d="M3 10l4-4M3 10l4 4" /></svg>
            </button>
            <button style={btnStyle} title="重做 (Ctrl+Y)"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('redo')}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H7a4 4 0 100 8h6" /><path d="M21 10l-4-4M21 10l-4 4" /></svg>
            </button>

            <div style={dividerStyle} />

            {/* ── 加粗 / 斜体 / 下划线 / 删除线 ── */}
            <button style={getBtnStyle('bold')} title="加粗 (Ctrl+B)"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')}
                onMouseEnter={(e) => onHover(e, activeFormats.bold)} onMouseLeave={(e) => onLeave(e, activeFormats.bold)}
            ><strong>B</strong></button>

            <button style={getBtnStyle('italic')} title="斜体 (Ctrl+I)"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')}
                onMouseEnter={(e) => onHover(e, activeFormats.italic)} onMouseLeave={(e) => onLeave(e, activeFormats.italic)}
            ><em>I</em></button>

            <button style={getBtnStyle('underline')} title="下划线 (Ctrl+U)"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')}
                onMouseEnter={(e) => onHover(e, activeFormats.underline)} onMouseLeave={(e) => onLeave(e, activeFormats.underline)}
            ><span style={{ textDecoration: 'underline' }}>U</span></button>

            <button style={getBtnStyle('strikeThrough')} title="删除线"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('strikeThrough')}
                onMouseEnter={(e) => onHover(e, activeFormats.strikeThrough)} onMouseLeave={(e) => onLeave(e, activeFormats.strikeThrough)}
            ><span style={{ textDecoration: 'line-through' }}>S</span></button>

            {/* 上标 / 下标 */}
            <button style={getBtnStyle('superscript')} title="上标"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('superscript')}
                onMouseEnter={(e) => onHover(e, activeFormats.superscript)} onMouseLeave={(e) => onLeave(e, activeFormats.superscript)}
            ><span style={{ fontSize: 10 }}>X<sup style={{ fontSize: 8 }}>²</sup></span></button>

            <button style={getBtnStyle('subscript')} title="下标"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('subscript')}
                onMouseEnter={(e) => onHover(e, activeFormats.subscript)} onMouseLeave={(e) => onLeave(e, activeFormats.subscript)}
            ><span style={{ fontSize: 10 }}>X<sub style={{ fontSize: 8 }}>₂</sub></span></button>

            <div style={dividerStyle} />

            {/* ── 字号 ── */}
            <div ref={fontSizeRef} style={{ position: 'relative' }}>
                <button
                    style={{ ...btnStyle, width: 'auto', padding: '0 6px', gap: 2 }}
                    title="字号"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowFontSize((v) => !v)}
                    onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
                >
                    <span style={{ fontSize: 11 }}>A</span>
                    <span style={{ fontSize: 14 }}>A</span>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, marginLeft: 2 }}><path d="M7 10l5 5 5-5z" /></svg>
                </button>
                {showFontSize && (
                    <div style={{ ...dropdownStyle, display: 'flex', gap: 2 }}>
                        {FONT_SIZES.map((size) => (
                            <button key={size} style={{ ...btnStyle, fontSize: 10 + Number(size) }}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { exec('fontSize', size); setShowFontSize(false); }}
                                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
                            >{size}</button>
                        ))}
                    </div>
                )}
            </div>

            <div style={dividerStyle} />

            {/* ── 文字颜色 / 背景色 ── */}
            <div ref={colorRef} style={{ position: 'relative' }}>
                <button style={btnStyle} title="文字颜色"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowColorPicker((v) => v === 'text' ? null : 'text')}
                    onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20h16" /><path d="M12 4L7 16h10L12 4z" /></svg>
                </button>

                <button style={btnStyle} title="背景色"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowColorPicker((v) => v === 'bg' ? null : 'bg')}
                    onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fillOpacity="0.3" /><path d="M7 14l3-6 3 6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                </button>

                {showColorPicker && (
                    <div style={{ ...dropdownStyle, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                        {(showColorPicker === 'text' ? TEXT_COLORS : BG_COLORS).map((color) => (
                            <button
                                key={color}
                                style={{
                                    width: 22, height: 22, borderRadius: 4,
                                    border: color === 'transparent' ? `2px dashed ${isLight ? '#d1d5db' : 'rgba(255,255,255,0.3)'}` : `2px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.15)'}`,
                                    background: color === 'transparent' ? 'transparent' : color,
                                    cursor: 'pointer', transition: 'transform 0.1s',
                                }}
                                title={color === 'transparent' ? '无背景' : color}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    if (showColorPicker === 'text') { exec('foreColor', color); }
                                    else { color === 'transparent' ? exec('removeFormat') : exec('hiliteColor', color); }
                                    setShowColorPicker(null);
                                }}
                                onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.2)'; }}
                                onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div style={dividerStyle} />

            {/* ── 列表 ── */}
            <button style={getBtnStyle('insertUnorderedList')} title="无序列表"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')}
                onMouseEnter={(e) => onHover(e, activeFormats.insertUnorderedList)} onMouseLeave={(e) => onLeave(e, activeFormats.insertUnorderedList)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="5" cy="6" r="1.5" fill="currentColor" /><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="5" cy="18" r="1.5" fill="currentColor" /></svg>
            </button>

            <button style={getBtnStyle('insertOrderedList')} title="有序列表"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertOrderedList')}
                onMouseEnter={(e) => onHover(e, activeFormats.insertOrderedList)} onMouseLeave={(e) => onLeave(e, activeFormats.insertOrderedList)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" /><text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text><text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2</text><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3</text></svg>
            </button>

            {/* 缩进 / 减少缩进 */}
            <button style={btnStyle} title="增加缩进"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('indent')}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="4" x2="21" y2="4" /><line x1="3" y1="20" x2="21" y2="20" /><line x1="11" y1="9" x2="21" y2="9" /><line x1="11" y1="14" x2="21" y2="14" /><path d="M3 8l4 4-4 4" /></svg>
            </button>

            <button style={btnStyle} title="减少缩进"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('outdent')}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="4" x2="21" y2="4" /><line x1="3" y1="20" x2="21" y2="20" /><line x1="11" y1="9" x2="21" y2="9" /><line x1="11" y1="14" x2="21" y2="14" /><path d="M7 8l-4 4 4 4" /></svg>
            </button>

            <div style={dividerStyle} />

            {/* ── 对齐 ── */}
            <button style={getBtnStyle('justifyLeft')} title="左对齐"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyLeft')}
                onMouseEnter={(e) => onHover(e, activeFormats.justifyLeft)} onMouseLeave={(e) => onLeave(e, activeFormats.justifyLeft)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
            </button>

            <button style={getBtnStyle('justifyCenter')} title="居中对齐"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyCenter')}
                onMouseEnter={(e) => onHover(e, activeFormats.justifyCenter)} onMouseLeave={(e) => onLeave(e, activeFormats.justifyCenter)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>
            </button>

            <button style={getBtnStyle('justifyRight')} title="右对齐"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('justifyRight')}
                onMouseEnter={(e) => onHover(e, activeFormats.justifyRight)} onMouseLeave={(e) => onLeave(e, activeFormats.justifyRight)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></svg>
            </button>

            <div style={dividerStyle} />

            {/* ── 引用块 ── */}
            <button style={btnStyle} title="引用块"
                onMouseDown={(e) => e.preventDefault()} onClick={handleBlockquote}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" /></svg>
            </button>

            {/* ── 代码块 ── */}
            <button style={btnStyle} title="代码块"
                onMouseDown={(e) => e.preventDefault()} onClick={handleCodeBlock}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
            </button>

            {/* ── 分割线 ── */}
            <button style={btnStyle} title="分割线"
                onMouseDown={(e) => e.preventDefault()} onClick={handleHorizontalRule}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /></svg>
            </button>

            <div style={dividerStyle} />

            {/* ── 插入链接 ── */}
            <button style={btnStyle} title="插入链接"
                onMouseDown={(e) => e.preventDefault()} onClick={handleInsertLink}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
            </button>

            {/* ── 插入图片 ── */}
            <button style={btnStyle} title="插入图片"
                onMouseDown={(e) => e.preventDefault()} onClick={handleInsertImage}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </button>

            {/* ── 插入表格 ── */}
            <div ref={tableRef} style={{ position: 'relative' }}>
                <button style={btnStyle} title="插入表格"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowTablePicker((v) => !v)}
                    onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
                </button>
                {showTablePicker && (
                    <div style={{ ...dropdownStyle, padding: 10, left: 'auto', right: 0, transform: 'none' }}>
                        <div style={{ fontSize: 11, color: isLight ? '#6b7280' : '#94a3b8', marginBottom: 6, textAlign: 'center' }}>
                            {tableHover.row > 0 ? `${tableHover.row} × ${tableHover.col}` : '选择表格大小'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
                            {Array.from({ length: 36 }, (_, i) => {
                                const row = Math.floor(i / 6) + 1;
                                const col = (i % 6) + 1;
                                const isActive = row <= tableHover.row && col <= tableHover.col;
                                return (
                                    <div
                                        key={i}
                                        onMouseEnter={() => setTableHover({ row, col })}
                                        onMouseLeave={() => setTableHover({ row: 0, col: 0 })}
                                        onClick={() => handleInsertTable(row, col)}
                                        style={{
                                            width: 18, height: 18, borderRadius: 2, cursor: 'pointer',
                                            border: `1px solid ${isLight ? '#d1d5db' : 'rgba(255,255,255,0.2)'}`,
                                            background: isActive ? (isLight ? '#6366f1' : '#818cf8') : (isLight ? '#f9fafb' : 'rgba(255,255,255,0.05)'),
                                            transition: 'background 0.1s',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div style={dividerStyle} />

            {/* ── 清除格式 ── */}
            <button style={btnStyle} title="清除格式"
                onMouseDown={(e) => e.preventDefault()} onClick={() => exec('removeFormat')}
                onMouseEnter={(e) => onHover(e)} onMouseLeave={(e) => onLeave(e)}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h11M9 20l4.286-14" /><path d="M18 4l-4 4M14 4l4 4" /></svg>
            </button>
        </div>
    );
}
