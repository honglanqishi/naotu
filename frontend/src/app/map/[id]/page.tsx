import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MapEditorClient } from '@/components/editor/MapEditorClient';

/**
 * MapEditorClient 是 'use client' 组件，内部持有 next/dynamic({ ssr: false })。
 * Server Component 不能直接使用 ssr:false，所以动态导入下移到 Client Component。
 * Suspense fallback 让页面外壳立即流式到达浏览器。
 */

function MapLoadingFallback() {
    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{ background: '#061616' }}
        >
            <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: '#c31432', borderTopColor: 'transparent' }}
            />
        </div>
    );
}

type Props = {
    params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
    title: '编辑脑图',
};

export default async function MapPage({ params }: Props) {
    const { id } = await params;
    return (
        <Suspense fallback={<MapLoadingFallback />}>
            <MapEditorClient mapId={id} />
        </Suspense>
    );
}
