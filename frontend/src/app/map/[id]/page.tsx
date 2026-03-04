import type { Metadata } from 'next';
import { MapEditor } from '@/components/editor/MapEditor';

type Props = {
    params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
    title: '编辑脑图',
};

export default async function MapPage({ params }: Props) {
    const { id } = await params;
    return <MapEditor mapId={id} />;
}
