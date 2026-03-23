import type { Metadata, Viewport } from 'next';
import { IosSafariBugsLab } from '@/components/labs/IosSafariBugsLab';

export const metadata: Metadata = {
    title: 'iOS Safari Bug Lab',
    description: 'iOS Safari H5 常见 Bug 复现、触发条件与修复方案演示页',
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function IosSafariLabPage() {
    return (
        <main
            className="w-full overflow-hidden bg-[radial-gradient(circle_at_10%_10%,#1d4ed8_0%,#0f172a_35%,#020617_100%)] px-4 py-2"
            style={{
                minHeight: '100vh',
                height: '100dvh',
                paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            }}
        >
            <div className="mx-auto flex h-full min-h-0 w-full justify-center">
                <IosSafariBugsLab />
            </div>
        </main>
    );
}
