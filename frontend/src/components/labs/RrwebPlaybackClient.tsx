'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

const RrwebFullscreenPlayback = dynamic(
    () =>
        import('@/components/labs/RrwebFullscreenPlayback').then(
            (module) => module.RrwebFullscreenPlayback
        ),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full w-full items-center justify-center text-center text-slate-200">
                正在初始化回放组件...
            </div>
        ),
    }
);

export function RrwebPlaybackClient() {
    useEffect(() => {
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    return <RrwebFullscreenPlayback />;
}
