// ============================================================================
// Naotu Electron — 本地密钥加密存储服务（主进程专用）
// ============================================================================
// 所有私钥/助记词在落盘前，均通过 AES-256-GCM + PBKDF2 派生密钥加密。
// 运行时密钥**仅**在签名瞬间解密到内存，用完立即擦除。
// 该模块绝不暴露给 renderer 进程。
// ============================================================================

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { app } from 'electron';
import type { ChainType } from '../ipc/channels.js';

// ─── 常量 ──────────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000;   // OWASP 2023 推荐值
const PBKDF2_KEYLEN     = 32;        // 256-bit
const PBKDF2_DIGEST     = 'sha512';
const AES_ALGO          = 'aes-256-gcm';
const IV_LENGTH         = 16;
const SALT_LENGTH       = 32;
const AUTH_TAG_LENGTH   = 16;

// ─── 存储路径 ──────────────────────────────────────────────────────

function getVaultDir(): string {
    // Electron userData: %APPDATA%/naotu  (Win) | ~/Library/.../naotu (Mac)
    const dir = path.join(app.getPath('userData'), 'vault');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getWalletPath(walletId: string): string {
    return path.join(getVaultDir(), `${walletId}.enc`);
}

function getIndexPath(): string {
    return path.join(getVaultDir(), 'wallets.json');
}

// ─── 加密 / 解密 ──────────────────────────────────────────────────

function deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
}

function encrypt(plaintext: string, password: string): Buffer {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key  = deriveKey(password, salt);
    const iv   = crypto.randomBytes(IV_LENGTH);

    const cipher     = crypto.createCipheriv(AES_ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag    = cipher.getAuthTag();

    // 格式：salt(32) + iv(16) + authTag(16) + ciphertext
    return Buffer.concat([salt, iv, authTag, encrypted]);
}

function decrypt(blob: Buffer, password: string): string {
    const salt     = blob.subarray(0, SALT_LENGTH);
    const iv       = blob.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag  = blob.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = blob.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(AES_ALGO, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf-8');
}

// ─── 钱包索引（不含私钥，仅元信息） ──────────────────────────────

export interface WalletMeta {
    id: string;
    address: string;
    chain: ChainType;
    label: string;
    createdAt: string;
}

function readIndex(): WalletMeta[] {
    const p = getIndexPath();
    if (!fs.existsSync(p)) return [];
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as WalletMeta[];
    } catch {
        return [];
    }
}

function writeIndex(wallets: WalletMeta[]): void {
    fs.writeFileSync(getIndexPath(), JSON.stringify(wallets, null, 2), 'utf-8');
}

// ─── 公开 API ─────────────────────────────────────────────────────

/**
 * 保存加密后的私钥/助记词到本地文件。
 * @returns WalletMeta（不含 secret）
 */
export function saveWallet(params: {
    id: string;
    secret: string;
    password: string;
    address: string;
    chain: ChainType;
    label: string;
}): WalletMeta {
    const encrypted = encrypt(params.secret, params.password);
    fs.writeFileSync(getWalletPath(params.id), encrypted);

    const meta: WalletMeta = {
        id:        params.id,
        address:   params.address,
        chain:     params.chain,
        label:     params.label,
        createdAt: new Date().toISOString(),
    };

    const index = readIndex().filter((w) => w.id !== params.id);
    index.push(meta);
    writeIndex(index);

    return meta;
}

/**
 * 解密私钥——仅在签名时短暂调用，调用方应在用完后擦除引用。
 */
export function loadSecret(walletId: string, password: string): string {
    const filePath = getWalletPath(walletId);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Wallet ${walletId} not found`);
    }
    const blob = fs.readFileSync(filePath);
    return decrypt(blob, password);
}

/**
 * 列出所有钱包元信息（不含私钥）。
 */
export function listWallets(): WalletMeta[] {
    return readIndex();
}

/**
 * 删除钱包（加密文件 + 索引记录）。
 */
export function deleteWallet(walletId: string): void {
    const filePath = getWalletPath(walletId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    const index = readIndex().filter((w) => w.id !== walletId);
    writeIndex(index);
}

/**
 * 获取钱包地址。
 */
export function getAddress(walletId: string): string {
    const wallet = readIndex().find((w) => w.id === walletId);
    if (!wallet) throw new Error(`Wallet ${walletId} not found`);
    return wallet.address;
}
