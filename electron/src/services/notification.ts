// ============================================================================
// Naotu Electron — 系统通知服务（主进程专用）
// ============================================================================
// 封装 Electron Notification API，提供：
//   1. 交易执行状态的实时系统级推送
//   2. 待办提醒的系统通知（替代/补充邮件）
//   3. 点击通知 → 跳转到前端指定路由
// ============================================================================

import { Notification, BrowserWindow, nativeImage, app } from 'electron';
import * as path from 'node:path';
import type { TxStatusUpdate, NotifyShowParams } from '../ipc/channels.js';

// ─── 图标（打包后取 resources/，开发态取 public/） ─────────────────

function getIconPath(): string {
    const isDev = !app.isPackaged;
    if (isDev) {
        return path.join(process.cwd(), 'frontend', 'public', 'icons', 'icon.png');
    }
    return path.join(process.resourcesPath, 'icons', 'icon.png');
}

// ─── 显示系统通知 ─────────────────────────────────────────────────

export function showNotification(params: NotifyShowParams): void {
    if (!Notification.isSupported()) {
        console.warn('[Notify] System notifications not supported on this platform');
        return;
    }

    const iconPath = getIconPath();
    const notification = new Notification({
        title: params.title,
        body: params.body,
        icon: nativeImage.createFromPath(iconPath),
        silent: false,
    });

    notification.on('click', () => {
        // 把焦点拉回窗口
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();

            // 如果指定了前端路由，通过 IPC 通知 renderer 跳转
            if (params.route) {
                win.webContents.send('notify:onClick', params.route);
            }
        }
    });

    notification.show();
}

// ─── 交易状态 → 系统通知（便捷封装） ─────────────────────────────

const STATUS_TEXT: Record<string, string> = {
    pending:   '⏳ 交易待确认',
    confirmed: '✅ 交易已确认',
    failed:    '❌ 交易失败',
};

export function notifyTxStatus(update: TxStatusUpdate): void {
    showNotification({
        title: STATUS_TEXT[update.status] ?? `交易状态: ${update.status}`,
        body:  update.message
            ?? `${update.chain.toUpperCase()} tx ${update.txHash.slice(0, 10)}…`
            + (update.blockNumber ? ` | Block #${update.blockNumber}` : ''),
        route: `/map`,  // 可按需改为交易详情路由
    });
}

// ─── 待办提醒 → 系统通知 ─────────────────────────────────────────

export function notifyReminder(title: string, notes: string): void {
    showNotification({
        title: `🔔 提醒：${title}`,
        body:  notes || '您设置的待办提醒已到时间',
        route: '/dashboard',
    });
}
