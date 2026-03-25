/* eslint-disable @next/next/no-img-element */
'use client';

import { ScrollLockBugLab } from '@/components/labs/ScrollLockBugLab';

export function ProductCardLabContent() {
    return (
        <div
            className="min-h-screen flex flex-col items-center gap-12 px-4 py-12"
            style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)' }}
        >
            <h1 className="text-2xl font-bold text-gray-800">Product Card — 1px Border & Safari 圆角 Bug</h1>

            {/* ==================== 滚动穿透 Bug 演示 ==================== */}
            <ScrollLockBugLab />

            {/* ==================== Retina 1px 边框原理 ==================== */}
            <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">为什么 1px 在 Retina 屏上看起来很粗？</h2>
                <div className="space-y-4 text-sm text-gray-600">
                    <p>
                        <strong>核心原理：</strong>Retina（HiDPI）屏幕的 DPR（Device Pixel Ratio）是 2× 或 3×。
                        DPR=2 意味着 <strong>1 个 CSS 像素 = 4 个物理像素</strong>（2×2）。
                        所以当你写 <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">border: 1px solid #ccc</code> 时，
                        浏览器实际绘制了 <strong>2×2 = 4 个物理像素点</strong>，肉眼看上去比设计稿粗了整整一倍。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                        <BorderDprDemo cssBorder="1px" label="CSS: 1px solid #ccc" dpr="DPR=1（普通屏）" />
                        <BorderDprDemo cssBorder="1px" label="CSS: 1px solid #ccc" dpr="DPR=2（iPhone/部分 Mac）" />
                        <BorderDprDemo cssBorder="1px" label="CSS: 1px solid #ccc" dpr="DPR=3（iPhone Pro Max）" />
                    </div>
                </div>
            </div>

            {/* ==================== 真正的 1px 物理像素边框 ==================== */}
            <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">工程化方案：真正的 1 物理像素边框</h2>
                <p className="text-sm text-gray-500 mb-4">
                    核心思路：用 <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">transform: scale()</code> 把边框缩放到 0.5，
                    DPR=2 时 0.5×2=1 个物理像素，DPR=3 时约 1.5 个物理像素。
                </p>
                <div className="flex flex-wrap gap-8 items-start justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-gray-500">方案 A（推荐）：伪元素 + scale(0.5)</span>
                        <PhysicalPixelCardA />
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-gray-500">方案 B：SVG border-image</span>
                        <PhysicalPixelCardB />
                    </div>
                </div>
            </div>

            {/* ==================== Bug 复现区 ==================== */}
            <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">iOS Safari 圆角 Bug 复现</h2>
                <div className="flex flex-wrap gap-8 items-start justify-center">
                    {/* Bug 1：图片溢出圆角 */}
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-red-500">Bug 1：图片直角盖住卡片圆角</span>
                        <BugCard1 />
                    </div>
                    {/* Bug 2：动画时圆角裁切失效 */}
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-red-500">Bug 2：动画/滑动时圆角变直角</span>
                        <BugCard2 />
                    </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200">
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Bug 根因分析</h3>
                    <ul className="space-y-1 text-xs text-red-600">
                        <li>
                            <strong>Bug 1：</strong>图片容器没有 <code className="bg-red-100 px-0.5 rounded">overflow: hidden</code>，
                            图片是直角矩形，盖住了父级的圆角效果。
                        </li>
                        <li>
                            <strong>Bug 2（更致命）：</strong>Safari 的圆角裁切依赖 <strong>overflow: hidden</strong> 形成的
                            <strong>Clip Path</strong>。当卡片参与 <code className="bg-red-100 px-0.5 rounded">transform</code>、
                            <code className="bg-red-100 px-0.5 rounded">animation</code>、嵌套 <code className="bg-red-100 px-0.5 rounded">overflow: scroll</code> 时，
                            Safari 将 Clip Path 降级，圆角瞬间变直角。
                            <br />
                            <strong>触发条件：</strong>硬件加速层（GPU compositing）与 Clip Path 冲突；
                            <code className="bg-red-100 px-0.5 rounded">will-change: transform</code> 误用触发合成层提升；
                            <code className="bg-red-100 px-0.5 rounded">overflow: hidden</code> 父容器内使用 <code className="bg-red-100 px-0.5 rounded">transform</code> 动画。
                        </li>
                    </ul>
                    <h3 className="text-sm font-semibold text-green-700 mt-3 mb-2">修复方案</h3>
                    <ul className="space-y-1 text-xs text-green-600">
                        <li><strong>Bug 1：</strong>给图片容器加 <code className="bg-green-100 px-0.5 rounded">overflow: hidden</code></li>
                        <li>
                            <strong>Bug 2：</strong>
                            用 <code className="bg-green-100 px-0.5 rounded">clip-path: inset(... round ...)</code> 替代
                            <code className="bg-green-100 px-0.5 rounded">overflow: hidden</code> 的圆角裁切；
                            避免在 <code className="bg-green-100 px-0.5 rounded">overflow: hidden</code> 父级内对子元素使用
                            <code className="bg-green-100 px-0.5 rounded">transform</code> 动画；
                            用 <code className="bg-green-100 px-0.5 rounded">translateZ(0)</code> 或 <code className="bg-green-100 px-0.5 rounded">will-change: opacity</code>
                            替代会触发合成层冲突的 transform。
                        </li>
                    </ul>
                </div>
            </div>

            {/* ==================== 修复验证区 ==================== */}
            <div className="max-w-3xl w-full rounded-2xl border border-gray-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">修复验证（hover 触发动画）</h2>
                <div className="flex flex-wrap gap-8 items-start justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-green-600">修复版 Bug1（加 overflow:hidden）</span>
                        <FixedCard1 />
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-medium text-green-600">修复版 Bug2（clip-path 替代 overflow）</span>
                        <FixedCard2 />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// DPR 可视化演示
// ---------------------------------------------------------------------------
function BorderDprDemo({ cssBorder, label, dpr }: { cssBorder: string; label: string; dpr: string }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-12 rounded-md" style={{ border: cssBorder + ' solid #999' }} />
            <span className="text-[10px] text-gray-500 text-center">{dpr}</span>
            <span className="text-[10px] font-mono text-gray-400">{label}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 方案 A：伪元素 + scale(0.5) 实现真正 1px 物理像素边框
// ---------------------------------------------------------------------------
function PhysicalPixelCardA() {
    return (
        <div className="true-1px-a">
            <img src="https://picsum.photos/seed/true-1px-a/400/400" alt="台灯" />
            <div className="p-3">
                <p className="text-sm font-medium text-gray-900">极简台灯</p>
                <p className="text-base font-semibold text-gray-900">¥ 299</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 方案 B：SVG border-image 实现真正 1px 边框
// ---------------------------------------------------------------------------
function PhysicalPixelCardB() {
    return (
        <div className="true-1px-b">
            <img src="https://picsum.photos/seed/true-1px-b/400/400" alt="陶瓷花瓶" />
            <div className="p-3">
                <p className="text-sm font-medium text-gray-900">陶瓷花瓶</p>
                <p className="text-base font-semibold text-gray-900">¥ 188</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bug 1：图片直角盖住卡片圆角（缺少 overflow:hidden）
// ---------------------------------------------------------------------------
function BugCard1() {
    return (
        <div className="bug-card-1">
            <img src="https://picsum.photos/seed/bug1/400/400" alt="抱枕" />
            <div className="p-3">
                <p className="text-sm font-medium text-gray-900">Bug 1：无 overflow</p>
                <p className="text-base font-semibold text-red-500">四角露出直角</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Bug 2：动画时 Safari 圆角裁切失效
// ---------------------------------------------------------------------------
function BugCard2() {
    return (
        <div className="bug-card-2-wrap">
            <div className="bug-card-2">
                <img src="https://picsum.photos/seed/bug2/400/400" alt="编织篮" />
                <div className="p-3">
                    <p className="text-sm font-medium text-gray-900">Bug 2：动画时失效</p>
                    <p className="text-base font-semibold text-red-500">Safari 圆角→直角</p>
                </div>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 block">hover 暂停观察</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 修复版 Bug1：加 overflow:hidden
// ---------------------------------------------------------------------------
function FixedCard1() {
    return (
        <div className="fixed-card-1">
            <img src="https://picsum.photos/seed/fixed1/400/400" alt="抱枕" />
            <div className="p-3">
                <p className="text-sm font-medium text-gray-900">修复版 Bug1</p>
                <p className="text-base font-semibold text-green-600">overflow:hidden ✓</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 修复版 Bug2：clip-path 替代 overflow:hidden 的圆角裁切
// ---------------------------------------------------------------------------
function FixedCard2() {
    return (
        <div className="fixed-card-2-wrap">
            <div className="fixed-card-2">
                <img src="https://picsum.photos/seed/fixed2/400/400" alt="编织篮" />
                <div className="p-3">
                    <p className="text-sm font-medium text-gray-900">修复版 Bug2</p>
                    <p className="text-base font-semibold text-green-600">clip-path:inset+动画 ✓</p>
                </div>
            </div>
            <span className="text-[10px] text-gray-400 mt-1 block">hover 暂停观察</span>
        </div>
    );
}
