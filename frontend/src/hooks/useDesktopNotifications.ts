// ============================================================================
// Naotu — useDesktopNotifications hook
// ============================================================================
// 在 Electron 桌面端自动监听交易状态推送和通知点击事件，
// 自动处理路由跳转。Web 端环境下静默降级（不报错、不订阅）。
// ============================================================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isDesktop, onTxStatusUpdate, onNotifyClick } from '@/lib/desktop-ipc';
import type { TxStatusUpdate } from '@/lib/desktop-ipc';

/**
 * 桌面端事件监听 hook。
 *
 * 功能：
 *   1. 监听主进程推送的交易状态更新，转为前端 toast 或状态更新
 *   2. 监听系统通知点击事件，自动用 Next.js router 跳转到指定路由
 *
 * @param onTxStatus 可选：自定义交易状态处理回调
 */
export function useDesktopNotifications(
    onTxStatus?: (update: TxStatusUpdate) => void
): { desktop: boolean } {
    const router = useRouter();
    const desktop = isDesktop();

    useEffect(() => {
        if (!desktop) return;

        // 订阅交易状态推送
        const unsubTx = onTxStatusUpdate((update) => {
            if (onTxStatus) {
                onTxStatus(update);
            }
            // 默认行为：这里可以集成 toast（sonner）
            // toast(`${update.chain} tx ${update.status}`);
        });

        // 订阅通知点击 → 路由跳转
        const unsubClick = onNotifyClick((route) => {
            router.push(route);
        });

        return () => {
            unsubTx();
            unsubClick();
        };
    }, [desktop, router, onTxStatus]);

    return { desktop };
}
