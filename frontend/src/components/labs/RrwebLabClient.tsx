'use client';

import dynamic from 'next/dynamic';

const RrwebPlaybackLab = dynamic(
    () =>
        import('@/components/labs/RrwebPlaybackLab').then(
            (module) => module.RrwebPlaybackLab
        ),
    {
        ssr: false,
        loading: () => (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 px-6 py-10 text-center text-slate-200">
                正在初始化 rrweb 演示环境...
            </div>
        ),
    }
);

export function RrwebLabClient() {
    return <RrwebPlaybackLab />;
}
