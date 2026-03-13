'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function DesktopAuthBridgeContent() {
    const searchParams = useSearchParams();
    const [message, setMessage] = useState('正在完成桌面端登录，请稍候...');

    useEffect(() => {
        const nonce = searchParams.get('nonce');
        const desktopRedirect = searchParams.get('desktopRedirect');

        if (!nonce || !desktopRedirect) {
            setMessage('参数缺失：无法完成桌面端登录');
            return;
        }

        let cancelled = false;

        const run = async () => {
            try {
                const response = await fetch(`/auth/desktop/grant?nonce=${encodeURIComponent(nonce)}`, {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || `Grant request failed: ${response.status}`);
                }

                const data = await response.json() as { grant?: string };
                if (!data.grant) {
                    throw new Error('Missing desktop grant');
                }

                if (cancelled) return;
                const redirectUrl = new URL(desktopRedirect);
                redirectUrl.searchParams.set('grant', data.grant);
                redirectUrl.searchParams.set('nonce', nonce);
                window.location.href = redirectUrl.toString();
            } catch (error) {
                if (cancelled) return;
                setMessage(`登录桥接失败：${(error as Error).message}`);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0f0f2f] text-white">
            <div className="rounded-xl border border-white/20 bg-black/30 px-6 py-4 text-sm">{message}</div>
        </main>
    );
}

export default function DesktopAuthBridgePage() {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-[#0f0f2f] text-white">
                    <div className="rounded-xl border border-white/20 bg-black/30 px-6 py-4 text-sm">
                        正在完成桌面端登录，请稍候...
                    </div>
                </main>
            }
        >
            <DesktopAuthBridgeContent />
        </Suspense>
    );
}
