'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';

/**
 * 全局 401 监听：捕获 api.ts 派发的 auth:unauthorized 事件，
 * 使用 Next.js router.push 做客户端软跳转，避免硬刷新丢失编辑状态。
 */
function AuthGuard() {
    const router = useRouter();
    useEffect(() => {
        const handleUnauthorized = () => {
            if (!window.location.pathname.startsWith('/login')) {
                router.push('/login');
            }
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, [router]);
    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 分钟
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthGuard />
            {children}
            <Toaster position="top-right" richColors />
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
            )}
        </QueryClientProvider>
    );
}
