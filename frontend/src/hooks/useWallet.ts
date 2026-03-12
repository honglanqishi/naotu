// ============================================================================
// Naotu — useWallet hook
// ============================================================================
// 封装桌面端钱包管理的 React Query 逻辑，遵循项目规范：
// 所有 useQuery/useMutation 必须封装在自定义 hook 中。
// ============================================================================

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    isDesktop,
    createWallet,
    importWallet,
    listWallets,
    deleteWallet,
    signTransaction,
    signMessage,
} from '@/lib/desktop-ipc';
import type {
    WalletInfo,
    WalletCreateParams,
    WalletImportParams,
    TxSignParams,
    TxSignResult,
    TxSignMessageParams,
    TxSignMessageResult,
} from '@/lib/desktop-ipc';

// Re-export for component usage
export type {
    WalletInfo,
    WalletCreateParams,
    WalletImportParams,
    TxSignParams,
    TxSignResult,
    TxSignMessageParams,
    TxSignMessageResult,
};

const WALLET_QUERY_KEY = ['wallets'] as const;

/**
 * 钱包管理 hook（仅在 Electron 桌面端可用）。
 *
 * 包含：
 *   - wallets: 钱包列表
 *   - createWallet / importWallet / deleteWallet: mutation
 *   - signTx / signMsg: 签名 mutation
 */
export function useWallet() {
    const queryClient = useQueryClient();
    const desktop = isDesktop();

    // ── 查询：钱包列表 ──
    const {
        data: wallets = [],
        isLoading,
        error,
    } = useQuery<WalletInfo[]>({
        queryKey: WALLET_QUERY_KEY,
        queryFn: listWallets,
        enabled: desktop,     // 仅桌面端启用
        staleTime: 30_000,
    });

    // ── Mutation：创建钱包 ──
    const createMutation = useMutation<WalletInfo, Error, WalletCreateParams>({
        mutationFn: createWallet,
        onSuccess: (wallet) => {
            queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
            toast.success(`钱包已创建：${wallet.address.slice(0, 10)}…`);
        },
        onError: (err) => {
            toast.error(`创建失败：${err.message}`);
        },
    });

    // ── Mutation：导入钱包 ──
    const importMutation = useMutation<WalletInfo, Error, WalletImportParams>({
        mutationFn: importWallet,
        onSuccess: (wallet) => {
            queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
            toast.success(`钱包已导入：${wallet.address.slice(0, 10)}…`);
        },
        onError: (err) => {
            toast.error(`导入失败：${err.message}`);
        },
    });

    // ── Mutation：删除钱包 ──
    const deleteMutation = useMutation<void, Error, string>({
        mutationFn: deleteWallet,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY });
            toast.success('钱包已删除');
        },
        onError: (err) => {
            toast.error(`删除失败：${err.message}`);
        },
    });

    // ── Mutation：交易签名 ──
    const signTxMutation = useMutation<TxSignResult, Error, TxSignParams>({
        mutationFn: signTransaction,
        onSuccess: (result) => {
            toast.success(`签名成功：${result.txHash.slice(0, 10)}…`);
        },
        onError: (err) => {
            toast.error(`签名失败：${err.message}`);
        },
    });

    // ── Mutation：消息签名 ──
    const signMsgMutation = useMutation<TxSignMessageResult, Error, TxSignMessageParams>({
        mutationFn: signMessage,
        onSuccess: () => {
            toast.success('消息签名成功');
        },
        onError: (err) => {
            toast.error(`签名失败：${err.message}`);
        },
    });

    return {
        // 状态
        wallets,
        isLoading,
        error,
        isDesktop: desktop,

        // 钱包管理
        createWallet:  createMutation.mutate,
        importWallet:  importMutation.mutate,
        deleteWallet:  deleteMutation.mutate,
        isCreating:    createMutation.isPending,
        isImporting:   importMutation.isPending,
        isDeleting:    deleteMutation.isPending,

        // 签名
        signTx:        signTxMutation.mutateAsync,
        signMsg:       signMsgMutation.mutateAsync,
        isSigning:     signTxMutation.isPending || signMsgMutation.isPending,
    };
}
