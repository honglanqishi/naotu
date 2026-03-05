'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Global rendering error caught:', error);

        // 如果是 fetch failed (网络或被拒绝), 可能是后端服务不可用或路由认证失败
        // 我们重定向到登录页让用户重新开始，或者给个提示
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
            router.push('/login');
        }
    }, [error, router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">页面加载异常</h2>
            <p className="mb-8 text-gray-600">
                {error.message.includes('fetch failed')
                    ? '无法连接到服务器，可能服务当前不可用。'
                    : '我们在加载此页面时遇到了一个问题。'}
            </p>
            <div className="flex gap-4">
                <button
                    onClick={() => router.push('/login')}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 hover:bg-blue-50 transition-colors"
                >
                    返回登录
                </button>
                <button
                    onClick={() => reset()}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 transition-colors"
                >
                    重试
                </button>
            </div>
        </div>
    );
}
