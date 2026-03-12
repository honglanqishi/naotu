// ============================================================================
// Naotu — Renderer 侧 IPC 桥接层（前端使用）
// ============================================================================
// 提供类型安全的 hook 和工具函数，封装 window.naotuDesktop API。
// 前端组件 import 此文件即可调用主进程能力，无需关心 IPC 细节。
// ============================================================================

import type { IpcApi } from '../../../electron/src/ipc/channels';
import type {
    WalletCreateParams,
    WalletImportParams,
    WalletInfo,
    TxSignParams,
    TxSignResult,
    TxSignMessageParams,
    TxSignMessageResult,
    TxStatusUpdate,
    NotifyShowParams,
    ChainType,
} from '../../../electron/src/ipc/channels';

// Re-export types for convenience
export type {
    WalletCreateParams,
    WalletImportParams,
    WalletInfo,
    TxSignParams,
    TxSignResult,
    TxSignMessageParams,
    TxSignMessageResult,
    TxStatusUpdate,
    NotifyShowParams,
    ChainType,
};

// ─── 类型扩展 window ──────────────────────────────────────────────

declare global {
    interface Window {
        naotuDesktop?: IpcApi;
    }
}

// ─── 运行环境检测 ──────────────────────────────────────────────────

/**
 * 当前是否运行在 Electron 桌面端。
 * 在 Web 浏览器中访问时返回 false，可用于条件渲染桌面专属功能。
 */
export function isDesktop(): boolean {
    return typeof window !== 'undefined' && !!window.naotuDesktop;
}

/**
 * 获取桌面端 IPC API。如果不在 Electron 环境中则返回 null。
 */
function getDesktopApi(): IpcApi | null {
    if (typeof window === 'undefined') return null;
    return window.naotuDesktop ?? null;
}

// ─── 钱包 API ──────────────────────────────────────────────────────

export async function createWallet(params: WalletCreateParams): Promise<WalletInfo> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.walletCreate(params);
}

export async function importWallet(params: WalletImportParams): Promise<WalletInfo> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.walletImport(params);
}

export async function listWallets(): Promise<WalletInfo[]> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.walletList();
}

export async function deleteWallet(id: string): Promise<void> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.walletDelete(id);
}

export async function getWalletAddress(id: string): Promise<string> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.walletGetAddress(id);
}

// ─── 签名 API ──────────────────────────────────────────────────────

export async function signTransaction(params: TxSignParams): Promise<TxSignResult> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.txSign(params);
}

export async function signMessage(params: TxSignMessageParams): Promise<TxSignMessageResult> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.txSignMessage(params);
}

// ─── 认证 API ──────────────────────────────────────────────────────

/**
 * 桌面端 Google OAuth 登录（通过系统浏览器 + Loopback IP）。
 * Web 端会抛出异常，调用方应先检查 isDesktop()。
 */
export async function desktopGoogleLogin(): Promise<{ success: boolean; error?: string }> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.googleLogin();
}

/**
 * 订阅桌面端登录成功事件（主进程 OAuth 流程完成后推送）。
 * @returns 取消订阅函数
 */
export function onLoginSuccess(callback: () => void): () => void {
    const api = getDesktopApi();
    if (!api) return () => {};
    return api.onLoginSuccess(callback);
}

// ─── 通知 API ──────────────────────────────────────────────────────

export async function showSystemNotification(params: NotifyShowParams): Promise<void> {
    const api = getDesktopApi();
    if (!api) throw new Error('Not running in desktop environment');
    return api.notifyShow(params);
}

// ─── 事件订阅 ──────────────────────────────────────────────────────

/**
 * 订阅交易状态更新推送。
 * @returns 取消订阅函数
 */
export function onTxStatusUpdate(callback: (update: TxStatusUpdate) => void): () => void {
    const api = getDesktopApi();
    if (!api) return () => {};  // Web 端静默忽略
    return api.onTxStatusUpdate(callback);
}

/**
 * 订阅通知点击事件（通知被点击后触发路由跳转）。
 * @returns 取消订阅函数
 */
export function onNotifyClick(callback: (route: string) => void): () => void {
    const api = getDesktopApi();
    if (!api) return () => {};
    return api.onNotifyClick(callback);
}

// ─── 应用信息 ──────────────────────────────────────────────────────

export async function getAppVersion(): Promise<string> {
    const api = getDesktopApi();
    if (!api) return 'web';
    return api.getVersion();
}

export async function getAppPlatform(): Promise<string> {
    const api = getDesktopApi();
    if (!api) return 'browser';
    return api.getPlatform();
}
