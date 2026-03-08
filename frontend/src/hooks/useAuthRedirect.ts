/**
 * useAuthRedirect
 *
 * 封装"会话状态检测 → 未登录时重定向"的公共逻辑。
 * 当 session 为 null 或 error 时，自动跳转 /login，
 * 同时将 session.user 同步到 Zustand authStore。
 *
 * 使用：
 *   const { session, isPending } = useAuthRedirect();
 */
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { useAuthStore } from '@/store/authStore';

export function useAuthRedirect() {
    const router = useRouter();
    const { data: session, isPending, error } = useSession();
    const { setUser, reset } = useAuthStore();

    // 同步用户信息到 Zustand
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

    // 未认证时重定向
    useEffect(() => {
        if (isPending) return;
        if (error) {
            toast.error('网络错误或无权访问，请重新登录');
            reset();
            router.push('/login');
        } else if (session === null) {
            reset();
            router.push('/login');
        }
    }, [session, isPending, error, router, reset]);

    return { session, isPending };
}

/** 从 session.user 计算用户显示名与首字母缩写 */
export function getUserInitials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
}
