'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ModalMode = 'none' | 'bugPC' | 'bugIOS' | 'fixedPC' | 'fixedIOS' | 'scrollChainBug' | 'scrollChainFixed';

export function ScrollLockBugLab() {
    const [modalMode, setModalMode] = useState<ModalMode>('none');
    const [scrollPosition, setScrollPosition] = useState(0);
    const bodyScrollTopRef = useRef(0);

    // Bug 方案：PC 端 - overflow: hidden（会跳动）
    const openBugPCModal = useCallback(() => {
        setModalMode('bugPC');
        document.body.style.overflow = 'hidden';
    }, []);

    const closeBugPCModal = useCallback(() => {
        setModalMode('none');
        document.body.style.overflow = '';
    }, []);

    // Bug 方案：iOS - overflow: hidden（无效，依然可以滚动穿透）
    const openBugIOSModal = useCallback(() => {
        setModalMode('bugIOS');
        document.body.style.overflow = 'hidden';
    }, []);

    const closeBugIOSModal = useCallback(() => {
        setModalMode('none');
        document.body.style.overflow = '';
    }, []);

    // 修复方案：PC 端 - overflow: hidden + padding-right 补偿滚动条宽度
    const openFixedPCModal = useCallback(() => {
        setModalMode('fixedPC');
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth}px`;
    }, []);

    const closeFixedPCModal = useCallback(() => {
        setModalMode('none');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }, []);

    // 修复方案：iOS - position: fixed + 保存/恢复滚动位置
    const openFixedIOSModal = useCallback(() => {
        setModalMode('fixedIOS');
        const scrollY = window.scrollY;
        bodyScrollTopRef.current = scrollY;
        setScrollPosition(scrollY);

        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
    }, []);

    const closeFixedIOSModal = useCallback(() => {
        setModalMode('none');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';

        window.scrollTo(0, bodyScrollTopRef.current);
    }, []);

    // 滚动链穿透 Bug：弹窗内列表滚动到底后继续穿透到背景
    const openScrollChainBugModal = useCallback(() => {
        setModalMode('scrollChainBug');
        const scrollY = window.scrollY;
        bodyScrollTopRef.current = scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
    }, []);

    const closeScrollChainBugModal = useCallback(() => {
        setModalMode('none');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, bodyScrollTopRef.current);
    }, []);

    // 滚动链穿透修复：overscroll-behavior + JS 边界检测
    const openScrollChainFixedModal = useCallback(() => {
        setModalMode('scrollChainFixed');
        const scrollY = window.scrollY;
        bodyScrollTopRef.current = scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';
    }, []);

    const closeScrollChainFixedModal = useCallback(() => {
        setModalMode('none');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, bodyScrollTopRef.current);
    }, []);

    // 清理：组件卸载时恢复 body 样式
    useEffect(() => {
        return () => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
        };
    }, []);

    return (
        <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">滚动穿透（Scroll-Through）Bug 演示</h2>
            <p className="text-sm text-gray-500 mb-4">
                点击按钮弹出全屏遮罩，观察背后页面是否能滚动（应该被锁住）。
                <br />
                <span className="text-red-500">向下滚动一段距离后再点击按钮，效果更明显。</span>
            </p>

            {/* 按钮组 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* PC Bug */}
                <div className="border border-red-200 rounded-xl p-4 bg-red-50">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">
                        PC 端 Bug：overflow: hidden
                    </h3>
                    <p className="text-xs text-red-600 mb-3">
                        滚动条消失导致页面宽度增加，视觉跳动（Layout Shift）
                    </p>
                    <button
                        type="button"
                        onClick={openBugPCModal}
                        className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
                    >
                        体验 PC Bug（跳动）
                    </button>
                </div>

                {/* PC 修复 */}
                <div className="border border-green-200 rounded-xl p-4 bg-green-50">
                    <h3 className="text-sm font-semibold text-green-700 mb-2">
                        PC 端修复：padding-right 补偿
                    </h3>
                    <p className="text-xs text-green-600 mb-3">
                        计算滚动条宽度，用 padding-right 补偿，防止跳动
                    </p>
                    <button
                        type="button"
                        onClick={openFixedPCModal}
                        className="w-full rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition"
                    >
                        体验 PC 修复（无跳动）
                    </button>
                </div>

                {/* iOS Bug */}
                <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                    <h3 className="text-sm font-semibold text-orange-700 mb-2">
                        iOS Bug：overflow: hidden 无效
                    </h3>
                    <p className="text-xs text-orange-600 mb-3">
                        iOS Safari 上，body overflow: hidden 根本防不住滚动穿透
                    </p>
                    <button
                        type="button"
                        onClick={openBugIOSModal}
                        className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                    >
                        体验 iOS Bug（可穿透）
                    </button>
                </div>

                {/* iOS 修复 */}
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                    <h3 className="text-sm font-semibold text-blue-700 mb-2">
                        iOS 修复：position: fixed
                    </h3>
                    <p className="text-xs text-blue-600 mb-3">
                        body 改为 fixed，保存滚动位置，关闭时恢复
                    </p>
                    <button
                        type="button"
                        onClick={openFixedIOSModal}
                        className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition"
                    >
                        体验 iOS 修复（已锁定）
                    </button>
                </div>
            </div>

            {/* 原理说明 */}
            <div className="space-y-4 text-sm">
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">PC 端 Bug 原因</h3>
                    <p className="text-xs text-red-600">
                        <strong>overflow: hidden</strong> 会让浏览器隐藏滚动条。
                        Windows/Linux 上滚动条占据约 <strong>17px</strong> 宽度，
                        隐藏后 <code className="bg-red-100 px-1 rounded">body.clientWidth</code> 增加 17px，
                        页面内容向右跳动，产生 <strong>Layout Shift</strong>。
                        <br />
                        <br />
                        <strong>修复：</strong>动态计算 <code className="bg-green-100 px-1 rounded">scrollbarWidth = window.innerWidth - document.documentElement.clientWidth</code>，
                        在设置 <code className="bg-green-100 px-1 rounded">overflow: hidden</code> 的同时，
                        给 body 加 <code className="bg-green-100 px-1 rounded">padding-right: {'{scrollbarWidth}'}px</code> 补偿宽度。
                    </p>
                </div>

                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                    <h3 className="text-sm font-semibold text-orange-700 mb-2">iOS 端 Bug 原因</h3>
                    <p className="text-xs text-orange-600">
                        iOS Safari 没有可见滚动条，<strong>overflow: hidden</strong> 只能防止 body 本身滚动，
                        但无法阻止触摸事件的"橡皮筋回弹"（elastic scrolling）。
                        用户在弹窗遮罩上滑动时，触摸事件会穿透到背后的长列表，触发滚动。
                        <br />
                        <br />
                        <strong>修复（原生方案）：</strong>
                        <br />
                        1. 弹窗打开时：保存当前 <code className="bg-blue-100 px-1 rounded">window.scrollY</code>
                        <br />
                        2. 设置 <code className="bg-blue-100 px-1 rounded">body.style.position = 'fixed'</code>
                        <br />
                        3. 设置 <code className="bg-blue-100 px-1 rounded">body.style.top = `-{'{scrollY}'}px`</code>（保持视觉位置）
                        <br />
                        4. 设置 <code className="bg-blue-100 px-1 rounded">body.style.width = '100%'</code>（防止宽度塌陷）
                        <br />
                        5. 弹窗关闭时：移除所有样式，调用 <code className="bg-blue-100 px-1 rounded">window.scrollTo(0, scrollY)</code> 恢复位置
                        <br />
                        <br />
                        <strong>边界情况：</strong>
                        <br />
                        • 弹窗内如果有长列表需要滚动，给弹窗内容容器单独设置 <code className="bg-blue-100 px-1 rounded">overflow-y: auto</code>
                        <br />
                        • 如果页面有 fixed 定位的导航栏，也需要补偿 top 值
                        <br />
                        • React 中需在 useEffect cleanup 中恢复样式，防止快速切换路由时样式残留
                    </p>
                </div>

                {/* 滚动链穿透说明 */}
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                    <h3 className="text-sm font-semibold text-purple-700 mb-2">滚动链穿透（Scroll Chaining）Bug</h3>
                    <p className="text-xs text-purple-600 mb-3">
                        弹窗内的长列表滚动到顶部/底部后，继续滑动会"穿透"到背景页面，触发背景滚动。
                        这是因为浏览器默认将滚动意图（Scroll Intent）向上传递给父级元素。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <button
                            type="button"
                            onClick={openScrollChainBugModal}
                            className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-600 transition"
                        >
                            体验滚动链 Bug
                        </button>
                        <button
                            type="button"
                            onClick={openScrollChainFixedModal}
                            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition"
                        >
                            体验修复版（已阻断）
                        </button>
                    </div>
                    <div className="text-xs text-purple-600 space-y-2">
                        <p>
                            <strong>修复方案 1（推荐）：CSS overscroll-behavior</strong>
                            <br />
                            给滚动容器加 <code className="bg-purple-100 px-1 rounded">overscroll-behavior: contain</code>，
                            阻止滚动链传播。兼容：Chrome 63+, Safari 16+（2022年9月）。
                        </p>
                        <p>
                            <strong>修复方案 2（兜底）：JS 边界检测</strong>
                            <br />
                            在 <code className="bg-purple-100 px-1 rounded">touchmove</code> 中检测边界：
                            <br />
                            • 向上滑且 <code className="bg-purple-100 px-1 rounded">scrollTop === 0</code> → preventDefault()
                            <br />
                            • 向下滑且 <code className="bg-purple-100 px-1 rounded">scrollTop + clientHeight === scrollHeight</code> → preventDefault()
                            <br />
                            注意：需给内容预留 1px 缓冲，避免卡在边界。
                        </p>
                    </div>
                </div>
            </div>

            {/* 弹窗 - Bug PC */}
            {modalMode === 'bugPC' && (
                <LotteryModal
                    title="PC Bug 演示"
                    subtitle="overflow: hidden（跳动）"
                    bgColor="bg-red-500/50"
                    onClose={closeBugPCModal}
                />
            )}

            {/* 弹窗 - Bug iOS */}
            {modalMode === 'bugIOS' && (
                <LotteryModal
                    title="iOS Bug 演示"
                    subtitle="overflow: hidden（无效）"
                    bgColor="bg-orange-500/50"
                    onClose={closeBugIOSModal}
                />
            )}

            {/* 弹窗 - Fixed PC */}
            {modalMode === 'fixedPC' && (
                <LotteryModal
                    title="PC 修复版"
                    subtitle="padding-right 补偿（无跳动）"
                    bgColor="bg-green-500/50"
                    onClose={closeFixedPCModal}
                />
            )}

            {/* 弹窗 - Fixed iOS */}
            {modalMode === 'fixedIOS' && (
                <LotteryModal
                    title="iOS 修复版"
                    subtitle="position: fixed + 保存位置"
                    bgColor="bg-blue-500/50"
                    onClose={closeFixedIOSModal}
                />
            )}

            {/* 弹窗 - 滚动链穿透 Bug */}
            {modalMode === 'scrollChainBug' && (
                <ScrollChainModal
                    title="滚动链穿透 Bug"
                    subtitle="列表滚动到底后继续穿透到背景"
                    bgColor="bg-purple-500/50"
                    preventScrollChaining={false}
                    onClose={closeScrollChainBugModal}
                />
            )}

            {/* 弹窗 - 滚动链穿透修复 */}
            {modalMode === 'scrollChainFixed' && (
                <ScrollChainModal
                    title="滚动链修复版"
                    subtitle="overscroll-behavior + JS 边界检测"
                    bgColor="bg-indigo-500/50"
                    preventScrollChaining={true}
                    onClose={closeScrollChainFixedModal}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// 抽奖弹窗组件
// ---------------------------------------------------------------------------
interface LotteryModalProps {
    title: string;
    subtitle: string;
    bgColor: string;
    onClose: () => void;
}

function LotteryModal({ title, subtitle, bgColor, onClose }: LotteryModalProps) {
    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${bgColor} backdrop-blur-sm`}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 关闭按钮 */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
                >
                    ✕
                </button>

                {/* 标题 */}
                <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{title}</h2>
                <p className="text-sm text-gray-500 mb-6 text-center">{subtitle}</p>

                {/* 抽奖动画占位 */}
                <div className="relative h-64 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center mb-6 overflow-hidden">
                    <div className="animate-spin text-white text-6xl">🎁</div>
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <span className="text-white text-lg font-semibold">抽奖动画</span>
                    </div>
                </div>

                {/* 说明文字 */}
                <div className="text-center text-sm text-gray-600 space-y-2">
                    <p>
                        <strong>测试方法：</strong>
                        <br />
                        点击遮罩外的灰色区域关闭弹窗，
                        <br />
                        在弹窗打开状态下尝试滚动页面。
                    </p>
                    <p className="text-xs text-gray-500">
                        正确行为：背后页面应该被完全锁住，无法滚动。
                    </p>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 滚动链穿透演示弹窗（包含长列表）
// ---------------------------------------------------------------------------
interface ScrollChainModalProps {
    title: string;
    subtitle: string;
    bgColor: string;
    preventScrollChaining: boolean;
    onClose: () => void;
}

function ScrollChainModal({ title, subtitle, bgColor, preventScrollChaining, onClose }: ScrollChainModalProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // JS 方案：边界检测，阻止滚动链穿透
    useEffect(() => {
        if (!preventScrollChaining) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        const handleTouchMove = (e: TouchEvent) => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isAtTop = scrollTop === 0;
            const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;

            // 检测滑动方向
            const touch = e.touches[0];
            const startY = touch.clientY;

            const handleTouchEnd = (endEvent: TouchEvent) => {
                const endTouch = endEvent.changedTouches[0];
                const deltaY = endTouch.clientY - startY;

                // 向上滑（deltaY < 0）且已在底部 → 阻止穿透
                if (deltaY < 0 && isAtBottom) {
                    e.preventDefault();
                }

                // 向下滑（deltaY > 0）且已在顶部 → 阻止穿透
                if (deltaY > 0 && isAtTop) {
                    e.preventDefault();
                }
            };

            container.addEventListener('touchend', handleTouchEnd, { once: true, passive: false });
        };

        container.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, [preventScrollChaining]);

    // 生成长列表数据（50 条）
    const items = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `列表项 ${i + 1}`,
        desc: `这是第 ${i + 1} 条数据，用于演示滚动到底后的穿透问题`,
    }));

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${bgColor} backdrop-blur-sm`}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: '80vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 固定头部 */}
                <div className="shrink-0 p-6 pb-4 border-b border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition z-10"
                    >
                        ✕
                    </button>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                </div>

                {/* 可滚动列表 */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4"
                    style={{
                        // CSS 方案：阻止滚动链传播
                        overscrollBehavior: preventScrollChaining ? 'contain' : 'auto',
                    }}
                >
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3 hover:bg-gray-100 transition"
                            >
                                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 固定底部说明 */}
                <div className="shrink-0 p-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-xs text-gray-600 text-center">
                        <strong>测试方法：</strong>
                        {preventScrollChaining ? (
                            <>
                                <br />
                                滚动到列表顶部/底部后，继续滑动，
                                <br />
                                背景页面应保持锁定，不会滚动。
                            </>
                        ) : (
                            <>
                                <br />
                                滚动到列表顶部/底部后，继续滑动，
                                <br />
                                <span className="text-red-500 font-semibold">背景页面会被"穿透"滚动（Bug）</span>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}
