// ============================================================================
// Naotu Electron — IPC 通道与类型定义（主进程 + preload + renderer 共用）
// ============================================================================
// 所有 IPC 通信的类型合约集中声明于此，三端 import 同一份定义，
// 确保频道名/入参/返回值在编译期即可验证。
// ============================================================================

// ─── 通道名枚举（避免硬编码字符串散落各处） ─────────────────────────

export const IPC_CHANNELS = {
    // ── 钱包 & 密钥 ──
    WALLET_CREATE:          'wallet:create',
    WALLET_IMPORT:          'wallet:import',
    WALLET_LIST:            'wallet:list',
    WALLET_DELETE:          'wallet:delete',
    WALLET_GET_ADDRESS:     'wallet:getAddress',

    // ── 交易签名 ──
    TX_SIGN:                'tx:sign',
    TX_SIGN_MESSAGE:        'tx:signMessage',

    // ── 系统通知 ──
    NOTIFY_SHOW:            'notify:show',
    NOTIFY_ON_CLICK:        'notify:onClick',       // main → renderer 事件

    // ── 交易状态推送（main → renderer） ──
    TX_STATUS_UPDATE:        'tx:statusUpdate',

    // ── 认证 ──
    AUTH_GOOGLE_LOGIN:      'auth:googleLogin',
    AUTH_LOGIN_SUCCESS:     'auth:loginSuccess',    // main → renderer 事件

    // ── 应用生命周期 ──
    APP_GET_VERSION:        'app:getVersion',
    APP_PLATFORM:           'app:platform',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ─── 支持的链 ──────────────────────────────────────────────────────

export type ChainType = 'evm' | 'solana' | 'bitcoin';

// ─── 钱包相关类型 ──────────────────────────────────────────────────

export interface WalletCreateParams {
    /** 用户提供的解锁口令（用于 AES-GCM 加密私钥） */
    password: string;
    /** 目标链类型 */
    chain: ChainType;
    /** 可选：钱包别名 */
    label?: string;
}

export interface WalletImportParams {
    /** 导入私钥（hex）或助记词 */
    secret: string;
    /** 导入方式 */
    secretType: 'privateKey' | 'mnemonic';
    password: string;
    chain: ChainType;
    label?: string;
}

export interface WalletInfo {
    id: string;
    address: string;
    chain: ChainType;
    label: string;
    createdAt: string;
}

// ─── 交易签名相关类型 ──────────────────────────────────────────────

export interface TxSignParams {
    walletId: string;
    password: string;
    chain: ChainType;
    /** 链原生交易对象（序列化 JSON） */
    txPayload: string;
}

export interface TxSignResult {
    signedTx: string;
    txHash: string;
}

export interface TxSignMessageParams {
    walletId: string;
    password: string;
    chain: ChainType;
    message: string;
}

export interface TxSignMessageResult {
    signature: string;
}

// ─── 交易状态推送 ──────────────────────────────────────────────────

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface TxStatusUpdate {
    txHash: string;
    chain: ChainType;
    status: TxStatus;
    /** 可选：区块号 */
    blockNumber?: number;
    /** 可选：人类可读描述 */
    message?: string;
    timestamp: string;
}

// ─── 系统通知 ──────────────────────────────────────────────────────

export interface NotifyShowParams {
    title: string;
    body: string;
    /** 点击通知后的前端路由路径（可选） */
    route?: string;
}

// ─── IPC 方法签名映射（用于 preload 类型推导） ─────────────────────

export interface IpcApi {
    // 钱包
    walletCreate(params: WalletCreateParams): Promise<WalletInfo>;
    walletImport(params: WalletImportParams): Promise<WalletInfo>;
    walletList(): Promise<WalletInfo[]>;
    walletDelete(id: string): Promise<void>;
    walletGetAddress(id: string): Promise<string>;

    // 签名
    txSign(params: TxSignParams): Promise<TxSignResult>;
    txSignMessage(params: TxSignMessageParams): Promise<TxSignMessageResult>;

    // 通知
    notifyShow(params: NotifyShowParams): Promise<void>;

    // 认证
    googleLogin(): Promise<{ success: boolean; error?: string }>;

    // 应用信息
    getVersion(): Promise<string>;
    getPlatform(): Promise<string>;

    // ── renderer 监听 主进程推送 ──
    onTxStatusUpdate(callback: (update: TxStatusUpdate) => void): () => void;
    onNotifyClick(callback: (route: string) => void): () => void;
    onLoginSuccess(callback: () => void): () => void;
}

// ─── IPC 结果封装（main → renderer 统一信封） ──────────────────────

export interface IpcResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
