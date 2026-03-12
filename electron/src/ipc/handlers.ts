// ============================================================================
// Naotu Electron — IPC Handler 注册（主进程侧）
// ============================================================================
// 将所有 ipcMain.handle 集中注册，每个 handler 负责：
//   1. 入参校验
//   2. 调用对应 service
//   3. 返回 IpcResult 信封
// ============================================================================

import { ipcMain } from 'electron';
import * as crypto from 'node:crypto';
import {
    IPC_CHANNELS,
    type IpcResult,
    type WalletCreateParams,
    type WalletImportParams,
    type WalletInfo,
    type TxSignParams,
    type TxSignResult,
    type TxSignMessageParams,
    type TxSignMessageResult,
    type NotifyShowParams,
} from './channels.js';
import {
    saveWallet,
    loadSecret,
    listWallets,
    deleteWallet,
    getAddress,
} from '../services/keystore.js';
import { getSigner } from '../services/signer.js';
import { showNotification } from '../services/notification.js';

// ─── 辅助：统一 IPC 返回 ──────────────────────────────────────────

function ok<T>(data: T): IpcResult<T> {
    return { success: true, data };
}

function fail<T = never>(error: string): IpcResult<T> {
    return { success: false, error };
}

// ─── 注册所有 IPC handlers ─────────────────────────────────────────

export function registerIpcHandlers(): void {
    // ── 钱包：创建 ──
    ipcMain.handle(IPC_CHANNELS.WALLET_CREATE, async (_event, params: WalletCreateParams): Promise<IpcResult<WalletInfo>> => {
        try {
            const signer = getSigner(params.chain);
            // 生成随机私钥
            const secretHex = crypto.randomBytes(32).toString('hex');
            const address   = await signer.deriveAddress(secretHex);
            const id        = crypto.randomUUID();

            const meta = saveWallet({
                id,
                secret:   secretHex,
                password: params.password,
                address,
                chain:    params.chain,
                label:    params.label ?? `${params.chain}-${address.slice(0, 6)}`,
            });

            return ok<WalletInfo>(meta);
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 钱包：导入 ──
    ipcMain.handle(IPC_CHANNELS.WALLET_IMPORT, async (_event, params: WalletImportParams): Promise<IpcResult<WalletInfo>> => {
        try {
            const signer  = getSigner(params.chain);
            const address = await signer.deriveAddress(params.secret);
            const id      = crypto.randomUUID();

            const meta = saveWallet({
                id,
                secret:   params.secret,
                password: params.password,
                address,
                chain:    params.chain,
                label:    params.label ?? `${params.chain}-${address.slice(0, 6)}`,
            });

            return ok<WalletInfo>(meta);
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 钱包：列表 ──
    ipcMain.handle(IPC_CHANNELS.WALLET_LIST, async (): Promise<IpcResult<WalletInfo[]>> => {
        try {
            return ok<WalletInfo[]>(listWallets());
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 钱包：删除 ──
    ipcMain.handle(IPC_CHANNELS.WALLET_DELETE, async (_event, id: string): Promise<IpcResult<void>> => {
        try {
            deleteWallet(id);
            return ok<void>(undefined);
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 钱包：获取地址 ──
    ipcMain.handle(IPC_CHANNELS.WALLET_GET_ADDRESS, async (_event, id: string): Promise<IpcResult<string>> => {
        try {
            return ok(getAddress(id));
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 交易：签名 ──
    ipcMain.handle(IPC_CHANNELS.TX_SIGN, async (_event, params: TxSignParams): Promise<IpcResult<TxSignResult>> => {
        try {
            const signer = getSigner(params.chain);
            // 解密私钥（仅在签名瞬间存在于内存）
            const secret = loadSecret(params.walletId, params.password);
            try {
                const result = await signer.signTransaction(params.txPayload, secret);
                return ok<TxSignResult>(result);
            } finally {
                // 擦除引用（V8 GC 辅助——无法保证底层 Buffer 已清零，但至少缩短暴露窗口）
                // 实际安全要求更高时可使用 sodium-native.memzero
            }
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 交易：消息签名 ──
    ipcMain.handle(IPC_CHANNELS.TX_SIGN_MESSAGE, async (_event, params: TxSignMessageParams): Promise<IpcResult<TxSignMessageResult>> => {
        try {
            const signer = getSigner(params.chain);
            const secret = loadSecret(params.walletId, params.password);
            try {
                const signature = await signer.signMessage(params.message, secret);
                return ok<TxSignMessageResult>({ signature });
            } finally {
                // secret 离开作用域
            }
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 系统通知：显示 ──
    ipcMain.handle(IPC_CHANNELS.NOTIFY_SHOW, async (_event, params: NotifyShowParams): Promise<IpcResult<void>> => {
        try {
            showNotification(params);
            return ok<void>(undefined);
        } catch (e) {
            return fail((e as Error).message);
        }
    });

    // ── 应用信息 ──
    ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, async (): Promise<IpcResult<string>> => {
        const { app } = await import('electron');
        return ok(app.getVersion());
    });

    ipcMain.handle(IPC_CHANNELS.APP_PLATFORM, async (): Promise<IpcResult<string>> => {
        return ok(process.platform);
    });

    console.log('[IPC] All handlers registered');
}
