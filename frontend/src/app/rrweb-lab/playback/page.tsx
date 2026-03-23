import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { RrwebPlaybackClient } from '@/components/labs/RrwebPlaybackClient';

export const metadata: Metadata = {
    title: 'rrweb Playback',
    description: 'rrweb 录制回放全屏展示',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RrwebPlaybackPage() {
    return (
        <main className="fixed inset-0 min-h-screen w-full bg-[radial-gradient(circle_at_15%_10%,#0e7490_0%,#0f172a_40%,#020617_100%)]">
            <Suspense
                fallback={
                    <div className="flex h-full w-full items-center justify-center text-center text-slate-200">
                        正在加载回放页面...
                    </div>
                }
            >
                <RrwebPlaybackClient />
            </Suspense>
        </main>
    );
}
