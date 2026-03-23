'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Example 1: 100vh + Safari bottom toolbar
// ---------------------------------------------------------------------------
function Example1({ fixed }: { fixed: boolean }) {
    return (
        <div
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]"
            style={{ height: '100%' }}
        >
            <div className="flex h-[40px] shrink-0 items-center justify-between border-b border-white/10 bg-[#1e293b] px-4">
                <span className="text-sm font-medium text-white">100vh vs 100dvh</span>
                <span
                    className="rounded px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: fixed ? '#22c55e' : '#f43f5e', color: 'white' }}
                >
                    {fixed ? '100dvh' : '100vh'}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2 text-xs text-slate-300">
                    <p>Safari 底部工具栏展开时：</p>
                    <ul className="list-inside list-disc space-y-1 pl-2">
                        <li><code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">100vh</code> = 视口高度（含工具栏）</li>
                        <li><code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">100dvh</code> = 动态视口高度（不含工具栏）</li>
                    </ul>
                    <div className="rounded border border-white/10 bg-black/20 p-2">
                        <p className="text-[10px] text-slate-400">
                            {fixed
                                ? '修复视图：容器高度会自动调整，底部输入框完整可见'
                                : 'Bug 视图：100vh 高度包含了工具栏，底部输入框会被遮挡'}
                        </p>
                    </div>
                </div>
            </div>

            <div
                className="shrink-0 flex items-center gap-2 border-t border-white/10 px-3 py-2"
                style={{
                    backgroundColor: fixed ? '#22c55e22' : '#f43f5e22',
                    paddingBottom: fixed ? 'calc(8px + env(safe-area-inset-bottom))' : '8px',
                }}
            >
                <input
                    className="flex-1 rounded-md border border-white/20 bg-black/40 p-2 text-[14px] text-white placeholder:text-slate-400"
                    placeholder={fixed ? '修复后: 完整可见' : 'Bug: 被工具栏遮挡...'}
                    readOnly
                />
                <button
                    className="rounded-md px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: fixed ? '#22c55e' : '#f43f5e' }}
                >
                    发送
                </button>
            </div>

            <div
                className="pointer-events-none absolute right-0 flex flex-col items-center justify-center rounded-l-md px-1 py-2 text-[10px] text-white/60"
                style={{ bottom: '70px', backgroundColor: '#6366f1' }}
            >
                <span>Safari</span>
                <span>工具栏</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Example 2: 软键盘弹起导致 fixed 失效 + 键盘收起白屏
// ---------------------------------------------------------------------------

/**
 * 完整修复方案说明：
 *
 * 1. 布局：最外层 display:flex; flex-direction:column; height:100dvh; overflow:hidden
 *         中间消息列表 flex:1; overflow-y:auto
 *         底部输入框 shrink-0，自然排在最下，不使用 fixed
 *
 * 2. 键盘弹起时：输入框 onFocus → scrollIntoView({ block:'end', behavior:'smooth' })
 *               同时用 Visual Viewport API 实时监听视觉视口高度变化
 *
 * 3. 键盘收起白屏修复（核心！）：输入框 onBlur → window.scrollTo(0, 0)
 *                              强制将页面滚动回顶部，防止键盘收起后留下空白
 *
 * 4. Visual Viewport API：window.visualViewport 在 iOS Safari 上提供真实的
 *    视觉视口高度（不含键盘），比 window.innerHeight 更可靠
 */
function Example2({ fixed, onInputFocus, viewportHeight }: {
    fixed: boolean;
    onInputFocus: () => void;
    viewportHeight: number | null;
}) {
    const [inputValue, setInputValue] = useState('');
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    // Bug 视图：键盘收起时的回弹白屏问题演示
    // 仅模拟：输入框失焦后页面无法自动回弹，留下空白
    const handleBugBlur = () => {
        // 在真实 iOS Safari 中，键盘收起时页面不会自动回弹
        // 此处用 document.documentElement.style.overflow 模拟"留白"状态
        // 实际复现：在 iPhone Safari 上，打开键盘 → 输入 → 点击完成 → 页面下方出现空白
    };

    // 修复视图：键盘收起时强制回弹
    const handleFixBlur = () => {
        // 核心修复：键盘收起后强制将整个文档滚动回顶部
        // 这样可以消除键盘收起后页面下方的空白区域
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        setIsKeyboardVisible(false);
    };

    const handleFocus = () => {
        setIsKeyboardVisible(true);
        onInputFocus();
    };

    const messages = [
        { role: 'ai', text: '你好，有什么可以帮你的吗？' },
        { role: 'user', text: '帮我查一下明天的天气' },
        { role: 'ai', text: '明天多云转晴，最高气温 26 度。' },
    ];

    return (
        <div
            className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1220]"
            style={{ height: '100%' }}
        >
            {/* 聊天标题栏 */}
            <div className="flex h-[40px] shrink-0 items-center justify-between border-b border-white/10 bg-[#1e293b] px-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">聊天界面</span>
                    {fixed && viewportHeight != null && (
                        <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold"
                            style={{ backgroundColor: '#6366f1', color: 'white' }}
                            title="Visual Viewport API 实时高度"
                        >
                            {viewportHeight}px
                        </span>
                    )}
                </div>
                <span
                    className="rounded px-2 py-1 text-xs font-semibold"
                    style={{ backgroundColor: fixed ? '#22c55e' : '#f43f5e', color: 'white' }}
                >
                    {fixed ? 'flex+blur回弹' : '无blur回弹'}
                </span>
            </div>

            {/* Visual Viewport 实时指示器（修复视图时显示） */}
            {fixed && (
                <div
                    className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-[10px] border-b"
                    style={{
                        backgroundColor: isKeyboardVisible ? '#f59e0b22' : '#22c55e22',
                        borderColor: isKeyboardVisible ? '#f59e0b44' : '#22c55e44',
                    }}
                >
                    <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: isKeyboardVisible ? '#f59e0b' : '#22c55e' }}
                    />
                    <span style={{ color: isKeyboardVisible ? '#f59e0b' : '#22c55e' }}>
                        {isKeyboardVisible
                            ? `键盘已弹起（Visual Viewport: ${viewportHeight}px）`
                            : `键盘已收起 — onBlur → window.scrollTo(0,0) 已执行`}
                    </span>
                </div>
            )}

            {/* 聊天消息列表 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className="max-w-[75%] rounded-lg px-3 py-2 text-xs"
                            style={{
                                backgroundColor: msg.role === 'user' ? (fixed ? '#22c55e' : '#f43f5e') : '#1e293b',
                                color: 'white',
                            }}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
                {/* 留白占位，模拟大量消息时的滚动 */}
                <div className="h-4" />
            </div>

            {/* 底部输入框 */}
            {fixed ? (
                /* 修复方案：flex 自然流 + scrollIntoView + onBlur 回弹 + Visual Viewport */
                <div
                    className="shrink-0 flex items-center gap-2 border-t border-white/10 px-3 py-2"
                    style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
                >
                    <input
                        id="chat-input-fixed"
                        className="flex-1 rounded-md border border-white/20 bg-black/40 p-2 text-[14px] text-white placeholder:text-slate-400"
                        placeholder="聚焦输入框触发键盘，用 Visual Viewport 监听..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleFixBlur}
                    />
                    <button className="rounded-md bg-[#22c55e] px-3 py-2 text-xs font-semibold text-white">发送</button>
                </div>
            ) : (
                /* Bug 演示：无 onBlur 回弹，键盘收起后留下空白 */
                <div
                    className="shrink-0 flex items-center gap-2 border-t border-white/10 px-3 py-2"
                    style={{ paddingBottom: '8px' }}
                >
                    <input
                        id="chat-input-bug"
                        className="flex-1 rounded-md border border-white/20 bg-black/40 p-2 text-[14px] text-white placeholder:text-slate-400"
                        placeholder="键盘收起时缺少 scrollTo(0,0)，白屏留白..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleBugBlur}
                    />
                    <button className="rounded-md bg-[#f43f5e] px-3 py-2 text-xs font-semibold text-white">发送</button>
                </div>
            )}

            {/* 修复说明 */}
            <div
                className="pointer-events-none absolute right-0 flex flex-col items-center justify-center rounded-l-md px-1 py-2 text-[10px] text-white/60"
                style={{ bottom: fixed ? '70px' : '70px', backgroundColor: fixed ? '#22c55e' : '#f43f5e' }}
            >
                <span>{fixed ? 'flex+blur回弹' : '缺blur回弹'}</span>
                <span>键盘收起</span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------
const EXAMPLES = [
    {
        id: '100vh-bottom-toolbar',
        title: '100vh 被 Safari 底部工具栏遮挡',
        bug: 'iOS Safari 底部工具栏会被计入 100vh 高度，使底部输入框被遮挡。',
        fix: '使用 100dvh（dynamic viewport height）替代 100vh，自动减去工具栏高度。',
    },
    {
        id: 'keyboard-fixed-scroll',
        title: '软键盘弹起导致 fixed 失效 + 收起白屏',
        bug: 'iOS Safari 键盘弹起时页面被推高，position:fixed 表现为 absolute；键盘收起后页面留下空白无法回弹。',
        fix: '放弃 fixed，用 Flex 布局 + height:100dvh + overflow:hidden；输入框 focus 时调用 scrollIntoView 抬起；blur 时 window.scrollTo(0,0) 回弹。',
    },
];

export function IosSafariBugsLab() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [showFixedVersion, setShowFixedVersion] = useState(false);
    const [fixedViewportHeight, setFixedViewportHeight] = useState<number | null>(null);

    useEffect(() => {
        if (!showFixedVersion) {
            setFixedViewportHeight(null);
            return;
        }

        const updateViewportHeight = () => {
            const nextHeight = window.visualViewport?.height ?? window.innerHeight;
            setFixedViewportHeight(Math.round(nextHeight));
        };

        updateViewportHeight();

        const visualViewport = window.visualViewport;
        visualViewport?.addEventListener('resize', updateViewportHeight);
        visualViewport?.addEventListener('scroll', updateViewportHeight);
        window.addEventListener('resize', updateViewportHeight);

        return () => {
            visualViewport?.removeEventListener('resize', updateViewportHeight);
            visualViewport?.removeEventListener('scroll', updateViewportHeight);
            window.removeEventListener('resize', updateViewportHeight);
        };
    }, [showFixedVersion]);

    const containerStyle = useMemo(() => {
        if (!showFixedVersion || fixedViewportHeight == null) {
            return undefined;
        }

        // page 外层有 py-2（上下各 8px），这里减去 16px 保证真机可视区完整展示
        const adjustedHeight = Math.max(fixedViewportHeight - 16, 320);
        return { height: `${adjustedHeight}px` };
    }, [fixedViewportHeight, showFixedVersion]);

    const goTo = useCallback((idx: number) => {
        setActiveIndex(idx);
        setShowFixedVersion(false);
    }, []);

    const handleInputFocus = useCallback(() => {
        // 修复：输入框聚焦时平滑滚动到可视区底部
        setTimeout(() => {
            document.getElementById('chat-input-fixed')?.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }, 150);
    }, []);

    const current = EXAMPLES[activeIndex];

    return (
        <div className="flex h-full w-full max-w-[980px] min-h-0 flex-col text-white" style={containerStyle}>
            {/* 导航栏 */}
            <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span
                        className="rounded px-2 py-1 text-xs font-semibold"
                        style={{ backgroundColor: showFixedVersion ? '#22c55e' : '#f43f5e', color: 'white' }}
                    >
                        {showFixedVersion ? '修复视图' : 'Bug 视图'}
                    </span>
                    <span className="text-xs text-slate-400">{current.title}</span>
                </div>
                <button
                    type="button"
                    onClick={() => setShowFixedVersion((v) => !v)}
                    className="rounded-lg border border-cyan-300/50 bg-cyan-500/20 px-3 py-1 text-xs font-semibold transition hover:bg-cyan-500/35"
                >
                    {showFixedVersion ? '切回 Bug' : '应用修复'}
                </button>
            </div>

            {/* 示例切换 */}
            <div className="mb-2 flex items-center gap-2">
                {EXAMPLES.map((ex, i) => (
                    <button
                        key={ex.id}
                        type="button"
                        onClick={() => goTo(i)}
                        className={`rounded px-2 py-1 text-[10px] transition ${
                            i === activeIndex
                                ? 'bg-cyan-500/40 text-white border border-cyan-300/50'
                                : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
                        }`}
                    >
                        {i + 1}. {ex.title.split(' ')[0]}
                    </button>
                ))}
            </div>

            {/* Bug / Fix 说明 */}
            <div className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-rose-300/25 bg-rose-900/15 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-rose-200">Bug</p>
                    <p className="mt-0.5 text-xs text-rose-50/90">{current.bug}</p>
                </div>
                <div className="rounded-lg border border-emerald-300/25 bg-emerald-900/15 p-2">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-200">Fix</p>
                    <p className="mt-0.5 text-xs text-emerald-50/90">{current.fix}</p>
                </div>
            </div>

            {/* Demo 区域 */}
            <div className="relative min-h-0 flex-1">
                {activeIndex === 0 && <Example1 fixed={showFixedVersion} />}
                {activeIndex === 1 && (
                    <Example2
                        fixed={showFixedVersion}
                        onInputFocus={handleInputFocus}
                        viewportHeight={showFixedVersion ? fixedViewportHeight : null}
                    />
                )}
            </div>
        </div>
    );
}
