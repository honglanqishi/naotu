'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils';
import { useMindMaps, type MindMap } from '@/hooks/useMindMaps';
import { useAuthRedirect, getUserInitials } from '@/hooks/useAuthRedirect';
import { Modal } from '@/components/ui/Modal';

// ── Figma MCP 资源映射 (node 9:2) ──────────────────────────────────
// 已下载至 /images/dashboard/，按语义命名
const ASSETS = {
    fabPlus:       '/images/dashboard/asset-01.svg', // 悬浮按钮加号
    logoIcon:      '/images/dashboard/asset-02.svg', // 导航 Logo 脑图图标
    searchIcon:    '/images/dashboard/asset-03.svg', // 搜索放大镜
    bellIcon:      '/images/dashboard/asset-04.svg', // 铃铛通知
    chevronIcon:   '/images/dashboard/asset-05.svg', // 用户栏 chevron
    navAll:        '/images/dashboard/asset-06.svg', // 侧栏-全部脑图
    navFav:        '/images/dashboard/asset-07.svg', // 侧栏-收藏
    navProject:    '/images/dashboard/asset-08.svg', // 侧栏-项目
    navRecent:     '/images/dashboard/asset-09.svg', // 侧栏-最近
    navTrash:      '/images/dashboard/asset-10.svg', // 侧栏-回收站
    newPlus:       '/images/dashboard/asset-11.svg', // 新建按钮加号
    card1Icon:     '/images/dashboard/asset-12.svg', // 卡片1 图标(蓝)
    dotsMenu:      '/images/dashboard/asset-13.svg', // 三点菜单
    clockIcon:     '/images/dashboard/asset-14.svg', // 时钟
    card2Icon:     '/images/dashboard/asset-15.svg', // 卡片2 图标(绿)
    card3Icon:     '/images/dashboard/asset-16.svg', // 卡片3 图标(粉)
    createPlus:    '/images/dashboard/asset-17.svg', // 创建新-加号
    card4Icon:     '/images/dashboard/asset-18.svg', // 卡片4 图标(紫)
} as const;

// 4种卡片图标主题循环
const ICON_THEMES = [
    { bg: 'rgba(59,130,246,0.2)', border: 'rgba(59,130,246,0.3)', src: ASSETS.card1Icon, w: '16.031px', h: '16.031px' },
    { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.3)', src: ASSETS.card2Icon, w: '16.034px', h: '18.002px' },
    { bg: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.3)', src: ASSETS.card3Icon, w: '19.898px', h: '20.602px' },
    { bg: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.3)', src: ASSETS.card4Icon, w: '21.984px', h: '16.652px' },
] as const;

export function DashboardContent() {
    const router = useRouter();

    // ── 认证守卫（含 Zustand 同步） ──
    const { session } = useAuthRedirect();

    // ── 数据 Hook ──
    const { maps, isLoading: isMapsLoading, isError: isMapsError,
            createMap, isCreating, deleteMap, isDeleting } = useMindMaps();


    // ── 新建脑图弹窗状态 ──
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');

    // ── 三点菜单 & 删除确认状态 ──
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<MindMap | null>(null);

    // 点击页面任意空白处关闭菜单（冒泡阶段，按钮内部用 stopPropagation 防止误触发）
    useEffect(() => {
        if (!menuOpenId) return;
        const handler = () => setMenuOpenId(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [menuOpenId]);

    const openDialog = () => {
        setNewTitle('');
        setNewDesc('');
        setDialogOpen(true);
    };

    const handleCreate = () => {
        if (isCreating) return;
        const title = newTitle.trim() || `新建脑图 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
        createMap(
            { title, description: newDesc.trim() || undefined },
            { onSuccess: () => { setDialogOpen(false); setNewTitle(''); setNewDesc(''); } },
        );
    };

    const handleDeleteConfirm = () => {
        if (!deleteTarget || isDeleting) return;
        deleteMap(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
    };

    const userName = session?.user?.name || session?.user?.email || '访客用户';
    const userInitials = getUserInitials(session?.user?.name || session?.user?.email);


    return (
        // Figma node 9:2
        <div className="bg-[#0f172a] flex flex-col isolate items-start relative min-h-screen w-full" data-node-id="9:2">

            {/* ── 新建脑图弹窗 ── */}
            <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} disabled={isCreating}>
                <div className="flex flex-col gap-[6px]">
                    <h2 className="text-[20px] font-bold text-white">新建脑图</h2>
                    <p className="text-[14px] text-[#64748b]">填写名称与备注后开始创作</p>
                </div>
                <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-[#94a3b8]">脑图名称 <span className="text-[#be185d]">*</span></label>
                    <input
                        autoFocus
                        type="text"
                        placeholder="例：产品路线图 Q2"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCreate()}
                        className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[10px] px-[14px] py-[10px] text-[15px] text-white placeholder-[#475569] outline-none focus:border-[#be185d] transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-[8px]">
                    <label className="text-[13px] font-medium text-[#94a3b8]">备注（可选）</label>
                    <textarea
                        rows={3}
                        placeholder="简要描述这张脑图的用途..."
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full resize-none bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-[10px] px-[14px] py-[10px] text-[15px] text-white placeholder-[#475569] outline-none focus:border-[#be185d] transition-colors"
                    />
                </div>
                <div className="flex gap-[12px] justify-end">
                    <button onClick={() => setDialogOpen(false)} disabled={isCreating} className="px-[20px] py-[10px] rounded-[10px] text-[14px] font-medium text-[#94a3b8] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors">取消</button>
                    <button onClick={handleCreate} disabled={isCreating} className="px-[20px] py-[10px] rounded-[10px] text-[14px] font-semibold text-white bg-[#be185d] hover:bg-[#9d174d] disabled:opacity-60 transition-colors">
                        {isCreating ? '创建中...' : '创建脑图'}
                    </button>
                </div>
            </Modal>

            {/* ── 删除确认弹窗 ── */}
            <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} disabled={isDeleting} maxWidth="400px">
                <div className="flex flex-col gap-[6px]">
                    <h2 className="text-[20px] font-bold text-white">删除脑图</h2>
                    <p className="text-[14px] text-[#94a3b8]">
                        确定要删除「<span className="text-white font-medium">{deleteTarget?.title}</span>」吗？此操作不可恢复。
                    </p>
                </div>
                <div className="flex gap-[12px] justify-end">
                    <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-[20px] py-[10px] rounded-[10px] text-[14px] font-medium text-[#94a3b8] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-colors">取消</button>
                    <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-[20px] py-[10px] rounded-[10px] text-[14px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors">
                        {isDeleting ? '删除中...' : '确认删除'}
                    </button>
                </div>
            </Modal>

            {/* ── Figma node 9:200 Background 渐变背景 ── */}
            <div
                className="absolute inset-[0_0_7px_0] z-[1] pointer-events-none"
                data-node-id="9:200"
                style={{ backgroundImage: "url('data:image/svg+xml;utf8,<svg viewBox=\\'0 0 1280 1031\\' xmlns=\\'http://www.w3.org/2000/svg\\' preserveAspectRatio=\\'none\\'><rect x=\\'0\\' y=\\'0\\' height=\\'100%\\' width=\\'100%\\' fill=\\'url(%23grad)\\' opacity=\\'1\\'/><defs><radialGradient id=\\'grad\\' gradientUnits=\\'userSpaceOnUse\\' cx=\\'0\\' cy=\\'0\\' r=\\'10\\' gradientTransform=\\'matrix(164.36 0 0 164.36 0 0)\\'><stop stop-color=\\'rgba(30,27,75,1)\\' offset=\\'0\\'/><stop stop-color=\\'rgba(15,23,42,1)\\' offset=\\'1\\'/></radialGradient></defs></svg>')" }}
            >
                <div className="absolute blur-[60px] h-[618.59px] left-[-64px] opacity-40 rounded-[282.65px] top-[-103.09px] w-[512px]" data-node-id="9:201" style={{ backgroundImage: 'linear-gradient(135deg, rgb(190, 24, 93) 0%, rgb(112, 26, 117) 100%)' }} />
                <div className="absolute blur-[50px] bottom-[-103.09px] h-[515.5px] opacity-30 right-[-64px] rounded-[240.88px] w-[448px]" data-node-id="9:202" style={{ backgroundImage: 'linear-gradient(135deg, rgb(14, 165, 233) 0%, rgb(45, 212, 191) 100%)' }} />
                <div className="absolute blur-[40px] h-[309.3px] opacity-20 right-[128px] rounded-[141.32px] top-[206.19px] w-[256px]" data-node-id="9:203" style={{ backgroundImage: 'linear-gradient(135deg, rgb(132, 204, 22) 0%, rgb(34, 197, 94) 100%)' }} />
            </div>

            {/* ── Figma node 9:3 悬浮创建按钮 ── */}
            <button
                onClick={openDialog}
                className="absolute backdrop-blur-[6px] bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.2)] border-solid bottom-[39px] flex items-center justify-center p-px right-[32px] rounded-[9999px] size-[56px] z-[4]"
                data-node-id="9:3"
            >
                <div className="absolute bg-[rgba(255,255,255,0)] bottom-[-1px] right-[-1px] rounded-[9999px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] size-[56px]" />
                <div className="relative shrink-0 size-[19.969px]">
                    <img alt="" className="absolute block max-w-none size-full" src={ASSETS.fabPlus} />
                </div>
            </button>

            {/* ── Figma node 9:7 Nav 导航栏 ── */}
            <div
                className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] border-solid flex items-center justify-between px-[25px] py-[17px] relative shrink-0 w-full z-[3]"
                data-node-id="9:7"
            >
                {/* Logo + 品牌名 */}
                <div className="flex gap-[12px] items-center relative shrink-0">
                    <div className="bg-[#be185d] flex items-center justify-center relative rounded-[12px] shrink-0 size-[40px]" data-node-id="9:9">
                        <div className="-translate-y-1/2 absolute bg-[rgba(255,255,255,0)] left-0 rounded-[12px] shadow-[0px_10px_15px_-3px_rgba(190,24,93,0.2),0px_4px_6px_-4px_rgba(190,24,93,0.2)] size-[40px] top-1/2" />
                        <div className="h-[23.016px] relative shrink-0 w-[24px]">
                            <img alt="" className="absolute block max-w-none size-full" src={ASSETS.logoIcon} />
                        </div>
                    </div>
                    <div className="font-bold h-[28px] flex items-center text-[20px] text-white tracking-[-0.5px]" data-node-id="9:14">
                        脑图空间
                    </div>
                </div>

                {/* 右侧：搜索 + 铃铛 + 用户 */}
                <div className="flex gap-[24px] items-center relative shrink-0">
                    {/* 搜索框 */}
                    <div className="flex items-start relative shrink-0" data-node-id="9:16">
                        <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid flex flex-col items-start overflow-clip pb-[11px] pl-[41px] pr-[17px] pt-[10px] relative rounded-[9999px] self-stretch shrink-0 w-[256px]" data-node-id="9:17">
                            <div className="font-normal leading-normal text-[#6b7280] text-[14px]" data-node-id="9:19">
                                搜索思维导图...
                            </div>
                        </div>
                        <div className="absolute bottom-[18.42%] flex flex-col items-start left-[12px] top-[18.42%]" data-node-id="9:20">
                            <div className="relative shrink-0 size-[17.054px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.searchIcon} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-[16px] items-center relative shrink-0" data-node-id="9:22">
                        {/* 铃铛 */}
                        <div className="flex flex-col items-center justify-center p-[8px] relative shrink-0" data-node-id="9:23">
                            <div className="h-[19.5px] relative shrink-0 w-[15.187px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.bellIcon} />
                            </div>
                        </div>
                        {/* 分隔线 */}
                        <div className="flex flex-col h-[32px] items-start px-[4px] relative shrink-0 w-[9px]" data-node-id="9:26">
                            <div className="bg-[rgba(255,255,255,0.1)] h-[32px] shrink-0 w-px" />
                        </div>
                        {/* 用户胶囊 */}
                        <div className="backdrop-blur-[5px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid flex gap-[12px] items-center pl-[9px] pr-[17px] py-[7px] relative rounded-[9999px] shrink-0" data-node-id="9:28">
                            <div className="relative rounded-[9999px] shrink-0 size-[32px] flex items-center justify-center" data-node-id="9:29" style={{ backgroundImage: 'linear-gradient(45deg, rgb(190, 24, 93) 0%, rgb(168, 85, 247) 100%)' }}>
                                <div className="font-bold text-[12px] text-center text-white uppercase" data-node-id="9:30">
                                    {userInitials}
                                </div>
                            </div>
                            <div className="font-medium h-[14px] flex items-center text-[14px] text-white" data-node-id="9:33">
                                {userName}
                            </div>
                            <div className="h-[6.598px] relative shrink-0 w-[11.156px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.chevronIcon} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Figma node 9:36 侧栏 + 主内容 Container ── */}
            <div className="flex h-[958px] items-start min-h-[958px] relative shrink-0 w-full z-[2]" data-node-id="9:36">

                {/* ── Figma node 9:37 Aside 侧栏 ── */}
                <div className="backdrop-blur-[10px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)] border-solid flex flex-col gap-[48px] items-start p-[25px] relative self-stretch shrink-0 w-[256px]" data-node-id="9:37">
                    {/* 导航链接组 */}
                    <div className="flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-node-id="9:38">
                        {/* 全部脑图（激活态） */}
                        <div className="bg-[rgba(255,255,255,0.1)] border-[#be185d] border-l-[3px] border-solid flex gap-[12px] items-center pl-[19px] pr-[16px] py-[12px] relative rounded-[8px] shrink-0 w-full" data-node-id="9:39">
                            <div className="relative shrink-0 size-[18px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.navAll} />
                            </div>
                            <div className="font-medium h-[24px] flex items-center text-[16px] text-white" data-node-id="9:43">全部脑图</div>
                        </div>
                        {/* 收藏 */}
                        <div className="flex gap-[12px] items-center px-[16px] py-[12px] relative rounded-[8px] shrink-0 w-full" data-node-id="9:44">
                            <div className="h-[16.357px] relative shrink-0 w-[17.098px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.navFav} />
                            </div>
                            <div className="font-medium h-[24px] flex items-center text-[#94a3b8] text-[16px]" data-node-id="9:48">收藏</div>
                        </div>
                        {/* 项目 */}
                        <div className="flex gap-[12px] items-center px-[16px] py-[12px] relative rounded-[8px] shrink-0 w-full" data-node-id="9:49">
                            <div className="h-[16.031px] relative shrink-0 w-[19.969px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.navProject} />
                            </div>
                            <div className="font-medium h-[24px] flex items-center text-[#94a3b8] text-[16px]" data-node-id="9:53">项目</div>
                        </div>
                        {/* 最近 */}
                        <div className="flex gap-[12px] items-center px-[16px] py-[12px] relative rounded-[8px] shrink-0 w-full" data-node-id="9:54">
                            <div className="h-[18.004px] relative shrink-0 w-[20.267px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.navRecent} />
                            </div>
                            <div className="font-medium h-[24px] flex items-center text-[#94a3b8] text-[16px]" data-node-id="9:58">最近</div>
                        </div>
                        {/* 回收站 */}
                        <div className="flex gap-[12px] items-center px-[16px] py-[12px] relative rounded-[8px] shrink-0 w-full" data-node-id="9:59">
                            <div className="h-[18px] relative shrink-0 w-[13.969px]">
                                <img alt="" className="absolute block max-w-none size-full" src={ASSETS.navTrash} />
                            </div>
                            <div className="font-medium h-[24px] flex items-center text-[#94a3b8] text-[16px]" data-node-id="9:63">回收站</div>
                        </div>
                    </div>
                    {/* 标签组 */}
                    <div className="flex flex-col gap-[16px] items-start relative shrink-0 w-full" data-node-id="9:64">
                        <div className="px-[16px] relative shrink-0 w-full" data-node-id="9:65">
                            <div className="font-semibold leading-[16px] text-[#64748b] text-[12px] tracking-[0.6px] uppercase" data-node-id="9:66">标签</div>
                        </div>
                        <div className="flex flex-col gap-[4px] items-start relative shrink-0 w-full" data-node-id="9:67">
                            <div className="flex gap-[12px] items-center px-[16px] py-[8px] relative shrink-0 w-full" data-node-id="9:68">
                                <div className="bg-[#10b981] rounded-[9999px] shrink-0 size-[8px]" />
                                <div className="font-normal h-[20px] flex items-center text-[#94a3b8] text-[14px]" data-node-id="9:70">工作</div>
                            </div>
                            <div className="flex gap-[12px] items-center px-[16px] py-[8px] relative shrink-0 w-full" data-node-id="9:71">
                                <div className="bg-[#3b82f6] rounded-[9999px] shrink-0 size-[8px]" />
                                <div className="font-normal h-[20px] flex items-center text-[#94a3b8] text-[14px]" data-node-id="9:73">研究</div>
                            </div>
                            <div className="flex gap-[12px] items-center px-[16px] py-[8px] relative shrink-0 w-full" data-node-id="9:74">
                                <div className="bg-[#ec4899] rounded-[9999px] shrink-0 size-[8px]" />
                                <div className="font-normal h-[20px] flex items-center text-[#94a3b8] text-[14px]" data-node-id="9:76">个人</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Figma node 9:77 Main 主内容 ── */}
                <div className="flex flex-[1_0_0] flex-col items-start min-h-px min-w-px overflow-clip p-[32px] relative self-stretch" data-node-id="9:77">
                    <div className="flex flex-col gap-[40px] items-start max-w-[1280px] relative shrink-0 w-full" data-node-id="9:78">

                        {/* 页头：标题 + 新建按钮 */}
                        <div className="flex items-center justify-between relative shrink-0 w-full" data-node-id="9:79">
                            <div className="flex flex-col gap-[4px] items-start relative shrink-0" data-node-id="9:80">
                                <div className="font-bold h-[36px] flex items-center text-[30px] text-white tracking-[-0.75px]" data-node-id="9:82">我的脑图</div>
                                <div className="font-normal h-[24px] flex items-center text-[#94a3b8] text-[16px]" data-node-id="9:84">管理并组织你的创意思考</div>
                            </div>
                            <button
                                onClick={openDialog}
                                className="bg-[#be185d] flex gap-[8px] items-center px-[24px] py-[12px] relative rounded-[12px] shrink-0"
                                data-node-id="9:85"
                            >
                                <div className="absolute bg-[rgba(255,255,255,0)] inset-[0_0.97px_0_0] rounded-[12px] shadow-[0px_10px_15px_-3px_rgba(190,24,93,0.2),0px_4px_6px_-4px_rgba(190,24,93,0.2)]" />
                                <div className="relative shrink-0 size-[13.969px]">
                                    <img alt="" className="absolute block max-w-none size-full" src={ASSETS.newPlus} />
                                </div>
                                <div className="font-semibold h-[24px] flex items-center text-[16px] text-center text-white" data-node-id="9:89">新建脑图</div>
                            </button>
                        </div>

                        {/* ── 卡片容器：动态渲染所有脑图 + 末尾创建卡 ── */}
                        {isMapsLoading ? (
                            <div className="grid grid-cols-4 gap-[20px] shrink-0 w-full auto-rows-[280px]" data-node-id="9:90">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div
                                        key={`dashboard-skeleton-${index}`}
                                        className="animate-pulse rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]"
                                    />
                                ))}
                            </div>
                        ) : isMapsError ? (
                            <div className="flex min-h-[280px] w-full items-center justify-center rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-[32px] text-center">
                                <div className="flex max-w-[420px] flex-col items-center gap-[10px]">
                                    <div className="text-[20px] font-semibold text-white">脑图加载失败</div>
                                    <div className="text-[14px] leading-[22px] text-[#94a3b8]">请检查网络连接后刷新页面，或稍后重试。</div>
                                </div>
                            </div>
                        ) : maps.length === 0 ? (
                            <div className="flex min-h-[280px] w-full items-center justify-center rounded-[16px] border border-dashed border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] p-[32px] text-center">
                                <div className="flex max-w-[420px] flex-col items-center gap-[12px]">
                                    <div className="bg-[rgba(255,255,255,0.05)] flex items-center justify-center rounded-[9999px] size-[56px]">
                                        <div className="relative shrink-0 size-[13.969px]">
                                            <img alt="" className="absolute block max-w-none size-full" src={ASSETS.createPlus} />
                                        </div>
                                    </div>
                                    <div className="text-[20px] font-semibold text-white">还没有脑图</div>
                                    <div className="text-[14px] leading-[22px] text-[#94a3b8]">点击“新建脑图”，开始整理你的想法与知识。</div>
                                    <button
                                        onClick={openDialog}
                                        className="mt-[4px] rounded-[12px] bg-[#be185d] px-[20px] py-[10px] text-[14px] font-semibold text-white hover:bg-[#9d174d] transition-colors"
                                    >
                                        立即创建
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="grid grid-cols-4 gap-[20px] shrink-0 w-full auto-rows-[280px]"
                                data-node-id="9:90"
                            >
                                {maps.map((map, i) => {
                                    const theme = ICON_THEMES[i % 4];
                                    return (
                                        <div
                                            key={map.id}
                                            onClick={() => {
                                                if (menuOpenId === map.id) {
                                                    setMenuOpenId(null);
                                                    return;
                                                }
                                                router.push(`/map/${map.id}`);
                                            }}
                                            className="backdrop-blur-[5px] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid flex flex-col items-start justify-between p-[21px] rounded-[16px] cursor-pointer relative"
                                        >
                                            <div className="flex items-start justify-between w-full">
                                                <div
                                                    className="flex items-center justify-center p-px relative rounded-[12px] shrink-0 size-[48px] border border-solid"
                                                    style={{ background: theme.bg, borderColor: theme.border }}
                                                >
                                                    <div className="relative shrink-0" style={{ width: theme.w, height: theme.h }}>
                                                        <img alt="" className="absolute block max-w-none size-full" src={theme.src} />
                                                    </div>
                                                </div>
                                                {/* 三点菜单按钮 */}
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setMenuOpenId((prev) => (prev === map.id ? null : map.id));
                                                        }}
                                                        className="flex flex-col items-center justify-center p-[6px] rounded-[8px] shrink-0 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                                                    >
                                                        <div className="h-[4.031px] relative shrink-0 w-[16.031px]">
                                                            <img alt="" className="absolute block max-w-none size-full" src={ASSETS.dotsMenu} />
                                                        </div>
                                                    </button>
                                                    {/* 下拉菜单 */}
                                                    {menuOpenId === map.id && (
                                                        <div
                                                            className="absolute right-0 top-[calc(100%+4px)] z-20 bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded-[10px] py-[4px] shadow-xl min-w-[120px]"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMenuOpenId(null);
                                                                    router.push(`/map/${map.id}`);
                                                                }}
                                                                className="w-full text-left px-[14px] py-[8px] text-[14px] text-[#94a3b8] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-colors"
                                                            >
                                                                打开编辑
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setMenuOpenId(null);
                                                                    setDeleteTarget(map);
                                                                }}
                                                                className="w-full text-left px-[14px] py-[8px] text-[14px] text-red-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-red-300 transition-colors"
                                                            >
                                                                删除
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-[4px] flex-1 justify-center">
                                                <div className="font-semibold leading-[28px] text-[18px] text-white line-clamp-2">{map.title}</div>
                                                <div className="font-normal leading-[20px] text-[#94a3b8] text-[14px] line-clamp-3">{map.description || ''}</div>
                                            </div>
                                            <div className="border-[rgba(255,255,255,0.05)] border-solid border-t w-full">
                                                <div className="flex items-center justify-between pt-[17px] w-full">
                                                    <div className="bg-[#475569] border-2 border-[#1e293b] border-solid flex items-center justify-center rounded-[9999px] shrink-0 size-[28px]">
                                                        <p className="font-bold text-[#f1f5f9] text-[10px]">{userInitials}</p>
                                                    </div>
                                                    <div className="flex gap-[4px] items-center">
                                                        <div className="relative shrink-0 size-[9.984px]">
                                                            <img alt="" className="absolute block max-w-none size-full" src={ASSETS.clockIcon} />
                                                        </div>
                                                        <div className="font-normal h-[16px] flex items-center text-[#64748b] text-[12px]">{formatRelativeTime(map.updatedAt)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* 末尾：创建新脑图虚线卡 */}
                                <button
                                    onClick={openDialog}
                                    className="border-2 border-[rgba(255,255,255,0.1)] border-dashed flex flex-col items-center justify-center rounded-[16px] gap-[12px]"
                                    data-node-id="9:170"
                                >
                                    <div className="bg-[rgba(255,255,255,0.05)] flex items-center justify-center rounded-[9999px] size-[48px]">
                                        <div className="relative shrink-0 size-[13.969px]">
                                            <img alt="" className="absolute block max-w-none size-full" src={ASSETS.createPlus} />
                                        </div>
                                    </div>
                                    <div className="font-medium text-[#94a3b8] text-[16px]">创建新脑图</div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
