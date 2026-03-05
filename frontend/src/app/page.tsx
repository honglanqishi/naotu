'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

/**
 * 首页：根据登录状态跳转
 *
 * Middleware 已做了初步 cookie 检查，但 cookie 可能过期/无效。
 * 这里用客户端 useSession() 做二次确认：
 * - 已登录 → /dashboard
 * - 未登录 → /login
 * - 加载中 → 显示 loading
 */
export default function HomePage() {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (isPending) return;
        if (session) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }, [session, isPending, router]);

    // Loading 状态：简洁的加载指示
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        </div>
    );
}
