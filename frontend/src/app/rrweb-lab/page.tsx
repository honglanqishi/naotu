import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { RrwebLabClient } from '@/components/labs/RrwebLabClient';

export const metadata: Metadata = {
    title: 'rrweb Lab',
    description: '使用 rrweb 模拟录制并回放用户操作流程',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RrwebLabPage() {
    return (
        <main className="min-h-[100dvh] w-full bg-[radial-gradient(circle_at_15%_10%,#0e7490_0%,#0f172a_40%,#020617_100%)] px-4 py-6 sm:px-6 sm:py-8">
            <Suspense
                fallback={
                    <div className="mx-auto w-full max-w-7xl rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-10 text-center text-slate-200">
                        正在加载 rrweb 演示页面...
                    </div>
                }
            >
                <RrwebLabClient />
            </Suspense>
        </main>
    );
}
