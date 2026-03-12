// ============================================================================
// Naotu Electron — Preload 脚本（contextBridge 隔离层）
// ============================================================================
// 此脚本在 renderer 加载前运行，通过 contextBridge 向 window 注入
// 一个受控的 `naotuDesktop` API 对象。
//
// 安全原则：
//   - contextIsolation: true  — preload 与页面 JS 隔离
//   - nodeIntegration: false  — renderer 无法直接用 Node API
//   - 只暴露白名单方法，每个方法仅转发到对应 IPC 通道
//   - 绝不暴露 ipcRenderer.send / ipcRenderer.on 原始能力
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';
import type {
    WalletCreateParams,
    WalletImportParams,
    TxSignParams,
    TxSignMessageParams,
    NotifyShowParams,
    TxStatusUpdate,
    IpcResult,
} from './ipc/channels.js';

const IPC_CHANNELS = {
    WALLET_CREATE: 'wallet:create',
    WALLET_IMPORT: 'wallet:import',
    WALLET_LIST: 'wallet:list',
    WALLET_DELETE: 'wallet:delete',
    WALLET_GET_ADDRESS: 'wallet:getAddress',
    TX_SIGN: 'tx:sign',
    TX_SIGN_MESSAGE: 'tx:signMessage',
    NOTIFY_SHOW: 'notify:show',
    NOTIFY_ON_CLICK: 'notify:onClick',
    TX_STATUS_UPDATE: 'tx:statusUpdate',
    AUTH_GOOGLE_LOGIN: 'auth:googleLogin',
    AUTH_LOGIN_SUCCESS: 'auth:loginSuccess',
    APP_GET_VERSION: 'app:getVersion',
    APP_PLATFORM: 'app:platform',
} as const;

// ─── 安全包装：invoke + 解包 IpcResult ──────────────────────────

async function invokeAndUnwrap<T>(channel: string, ...args: unknown[]): Promise<T> {
    const result: IpcResult<T> = await ipcRenderer.invoke(channel, ...args);
    if (!result.success) {
        throw new Error(result.error ?? 'Unknown IPC error');
    }
    return result.data as T;
}

// ─── 暴露给 renderer 的 API ──────────────────────────────────────

contextBridge.exposeInMainWorld('naotuDesktop', {
    // ── 钱包 ──
    walletCreate:     (params: WalletCreateParams) => invokeAndUnwrap(IPC_CHANNELS.WALLET_CREATE, params),
    walletImport:     (params: WalletImportParams) => invokeAndUnwrap(IPC_CHANNELS.WALLET_IMPORT, params),
    walletList:       ()                           => invokeAndUnwrap(IPC_CHANNELS.WALLET_LIST),
    walletDelete:     (id: string)                 => invokeAndUnwrap(IPC_CHANNELS.WALLET_DELETE, id),
    walletGetAddress: (id: string)                 => invokeAndUnwrap(IPC_CHANNELS.WALLET_GET_ADDRESS, id),

    // ── 签名 ──
    txSign:        (params: TxSignParams)        => invokeAndUnwrap(IPC_CHANNELS.TX_SIGN, params),
    txSignMessage: (params: TxSignMessageParams) => invokeAndUnwrap(IPC_CHANNELS.TX_SIGN_MESSAGE, params),

    // ── 通知 ──
    notifyShow: (params: NotifyShowParams) => invokeAndUnwrap(IPC_CHANNELS.NOTIFY_SHOW, params),

    // ── 应用信息 ──
    getVersion:  () => invokeAndUnwrap<string>(IPC_CHANNELS.APP_GET_VERSION),
    getPlatform: () => invokeAndUnwrap<string>(IPC_CHANNELS.APP_PLATFORM),

    // ── 认证 ──
    googleLogin: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GOOGLE_LOGIN),

    // ── 订阅主进程推送事件（只注册监听，不暴露 ipcRenderer.on） ──
    onTxStatusUpdate: (callback: (update: TxStatusUpdate) => void): (() => void) => {
        const listener = (_event: Electron.IpcRendererEvent, update: TxStatusUpdate) => callback(update);
        ipcRenderer.on(IPC_CHANNELS.TX_STATUS_UPDATE, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.TX_STATUS_UPDATE, listener); };
    },

    onNotifyClick: (callback: (route: string) => void): (() => void) => {
        const listener = (_event: Electron.IpcRendererEvent, route: string) => callback(route);
        ipcRenderer.on(IPC_CHANNELS.NOTIFY_ON_CLICK, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.NOTIFY_ON_CLICK, listener); };
    },

    onLoginSuccess: (callback: () => void): (() => void) => {
        const listener = () => callback();
        ipcRenderer.on(IPC_CHANNELS.AUTH_LOGIN_SUCCESS, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.AUTH_LOGIN_SUCCESS, listener); };
    },
});
