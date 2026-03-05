'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';

/**
 * 全局 401 和网络错误监听：捕获 api.ts 派发的事件，
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
        const handleNetworkError = () => {
            toast.error('无法连接到后端服务', { description: '网络错误或服务不可用，请稍后再试' });
            if (!window.location.pathname.startsWith('/login')) {
                router.push('/login');
            }
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        window.addEventListener('auth:network_error', handleNetworkError);
        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
            window.removeEventListener('auth:network_error', handleNetworkError);
        };
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
