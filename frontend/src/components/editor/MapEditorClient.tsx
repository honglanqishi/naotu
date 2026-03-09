'use client';

/**
 * MapEditorClient
 *
 * Client Component 包装层，持有 next/dynamic + ssr:false 的动态导入。
 * Server Component（app/map/[id]/page.tsx）不能直接用 ssr:false，
 * 所以把这个逻辑下移到 Client Component，再由 page.tsx 渲染此组件。
 */
import dynamic from 'next/dynamic';

const MapEditor = dynamic(
    () => import('@/components/editor/MapEditor').then((m) => m.MapEditor),
    { ssr: false },
);

export function MapEditorClient({ mapId }: { mapId: string }) {
    return <MapEditor mapId={mapId} />;
}
