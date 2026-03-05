'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSession, signOut } from '@/lib/auth-client';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import Image from 'next/image';


interface MindMap {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export function DashboardContent() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: session, isPending, error } = useSession();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');

    // 将 better-auth session 同步到 Zustand store，
    // 使其他组件可以通过 useAuthStore() 直接访问用户信息
    const { setUser, reset } = useAuthStore();

    useEffect(() => {
        if (session?.user) {
            setUser({
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
            });
        }
    }, [session, setUser]);

    // 处理无权限或网络错误引发的会话失效，直接重定向
    useEffect(() => {
        if (!isPending) {
            if (error) {
                toast.error('网络错误或无权访问，请重新登录');
                reset();
                router.push('/login');
            } else if (session === null) {
                reset();
                router.push('/login');
            }
        }
    }, [session, isPending, error, router, reset]);

    // 获取导图列表
    const { data, isLoading } = useQuery({
        queryKey: ['maps'],
        queryFn: async () => {
            const res = await api.get<{ maps: MindMap[] }>('/api/maps');
            return res.data.maps;
        },
    });

    // 创建导图
    const createMutation = useMutation({
        mutationFn: async (title: string) => {
            const res = await api.post<{ map: MindMap }>('/api/maps', { title });
            return res.data.map;
        },
        onSuccess: (map) => {
            queryClient.invalidateQueries({ queryKey: ['maps'] });
            toast.success('脑图创建成功');
            setIsCreating(false);
            setNewTitle('');
            router.push(`/map/${map.id}`);
        },
        onError: () => toast.error('创建失败，请重试'),
    });

    // 删除导图
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/api/maps/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maps'] });
            toast.success('已删除');
        },
        onError: () => toast.error('删除失败'),
    });

    const handleCreate = () => {
        if (!newTitle.trim()) return;
        createMutation.mutate(newTitle.trim());
    };

    const handleSignOut = async () => {
        await signOut();
        reset();
        router.push('/login');
    };

    const user = session?.user;

    return (
        <div className="min-h-screen" style={{ background: 'var(--background)' }}>
            {/* 顶栏 */}
            <header
                className="sticky top-0 z-10 border-b"
                style={{
                    background: 'rgba(15,15,23,0.8)',
                    backdropFilter: 'blur(12px)',
                    borderColor: 'var(--border)',
                }}
            >
                <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="8" r="4" fill="white" />
                                <circle cx="6" cy="22" r="3" fill="white" opacity="0.7" />
                                <circle cx="26" cy="22" r="3" fill="white" opacity="0.7" />
                                <line x1="16" y1="12" x2="6" y2="19" stroke="white" strokeWidth="1.5" opacity="0.5" />
                                <line x1="16" y1="12" x2="26" y2="19" stroke="white" strokeWidth="1.5" opacity="0.5" />
                            </svg>
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                            Naotu
                        </span>
                    </div>

                    {user && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                {user.name || user.email}
                            </span>
                            {user.image && (
                                <Image
                                    src={user.image}
                                    alt={user.name || 'User'}
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                            )}
                            <button
                                onClick={handleSignOut}
                                className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                                style={{
                                    color: 'var(--foreground-muted)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                退出
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* 主内容 */}
            <main className="max-w-6xl mx-auto px-6 py-8">
                {/* 页头 */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                            我的脑图
                        </h1>
                        <p className="mt-1 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                            {data?.length ?? 0} 张思维导图
                        </p>
                    </div>

                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200"
                        style={{
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            color: 'white',
                            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        新建脑图
                    </button>
                </div>

                {/* 创建弹窗 */}
                {isCreating && (
                    <div
                        className="mb-6 p-5 rounded-xl border animate-fade-in"
                        style={{ background: 'var(--background-card)', borderColor: 'var(--border)' }}
                    >
                        <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground-muted)' }}>
                            新建思维导图
                        </p>
                        <div className="flex gap-3">
                            <input
                                autoFocus
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate();
                                    if (e.key === 'Escape') setIsCreating(false);
                                }}
                                placeholder="输入导图名称..."
                                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    background: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--foreground)',
                                }}
                            />
                            <button
                                onClick={handleCreate}
                                disabled={!newTitle.trim() || createMutation.isPending}
                                className="px-4 py-2 rounded-lg text-sm font-medium"
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                    opacity: !newTitle.trim() || createMutation.isPending ? 0.5 : 1,
                                }}
                            >
                                {createMutation.isPending ? '创建中...' : '创建'}
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 rounded-lg text-sm"
                                style={{ color: 'var(--foreground-muted)', border: '1px solid var(--border)' }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                {/* 导图卡片列表 */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-36 rounded-xl skeleton" />
                        ))}
                    </div>
                ) : data && data.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.map((map) => (
                            <MapCard
                                key={map.id}
                                map={map}
                                onOpen={() => router.push(`/map/${map.id}`)}
                                onDelete={() => deleteMutation.mutate(map.id)}
                            />
                        ))}
                    </div>
                ) : (
                    // 空状态
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: 'var(--background-card)', border: '1px solid var(--border)' }}
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="5" cy="19" r="2" />
                                <circle cx="19" cy="19" r="2" />
                                <path d="M12 7v4M7.5 17l4.5-6M16.5 17l-4.5-6" style={{ color: 'var(--foreground-subtle)' }} />
                            </svg>
                        </div>
                        <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                            还没有思维导图
                        </p>
                        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                            点击"新建脑图"开始记录你的知识
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}

// 根据 id 生成固定强调色
const ACCENT_COLORS = ['#f42495', '#f49524', '#4285f4', '#34a853', '#a855f7', '#06b6d4', '#ef4444'];
function getAccentColor(id: string): string {
    const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return ACCENT_COLORS[sum % ACCENT_COLORS.length];
}

// 从标题提取瓦片缩写标签（最多 3 个字符）
function getTileLabel(title: string): string {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.slice(0, 3).toUpperCase();
}

/**
 * 导图卡片组件 - 基于 Figma "To-do List Board" 设计（node-id: 101:1365）
 * 视觉：深灰底 + 顶部钢蓝标签 + 彩色左侧条任务瓦片 + 底部时间标签
 */
function MapCard({
    map,
    onOpen,
    onDelete,
}: {
    map: MindMap;
    onOpen: () => void;
    onDelete: () => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    // Click-Away：点击菜单按钮或下拉菜单区域之外时自动关闭
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!showMenu) return;
        const handleClickAway = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current && !menuRef.current.contains(target) &&
                btnRef.current && !btnRef.current.contains(target)
            ) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickAway);
        return () => document.removeEventListener('mousedown', handleClickAway);
    }, [showMenu]);
    const accentColor = getAccentColor(map.id);
    const tileLabel = getTileLabel(map.title);

    return (
        <div
            className="group relative flex flex-col gap-[10px] items-start p-[10px] rounded-lg cursor-pointer animate-fade-in transition-all duration-200"
            style={{ background: '#373737' }}
            onClick={onOpen}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
        >


            {/* 任务瓦片：彩色左侧条 + 白色内容区 */}
            <div className="flex items-stretch w-full">
                {/* 左侧彩色条 + 竖排缩写 */}
                <div
                    className="relative w-[25px] flex-none flex items-center justify-center rounded-l-[8px]"
                    style={{ background: accentColor, minHeight: '48px' }}
                >
                    <span
                        className="text-[10px] font-bold text-white select-none"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                        {tileLabel}
                    </span>
                </div>

                {/* 右侧白色内容区 */}
                <div className="flex-1 bg-white p-[10px] rounded-r-[8px] flex flex-col justify-center">
                    <p className="text-[12px] text-black font-normal leading-normal line-clamp-2 mb-0">
                        {map.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#888' }}>
                        {formatRelativeTime(map.updatedAt)}
                    </p>
                </div>
            </div>



            {/* 菜单按钮（hover 显示） */}
            <button
                ref={btnRef}
                className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: 'rgba(0,0,0,0.5)' }}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                </svg>
            </button>

            {/* 下拉菜单 */}
            {showMenu && (
                <div
                    ref={menuRef}
                    className="absolute top-8 right-2 z-20 rounded-lg border py-1 shadow-lg"
                    style={{ background: '#2a2a2a', borderColor: 'rgba(255,255,255,0.12)', minWidth: '100px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                        onClick={() => {
                            setShowMenu(false);
                            onDelete();
                        }}
                    >
                        删除
                    </button>
                </div>
            )}
        </div>
    );
}
