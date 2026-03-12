// ============================================================================
// Naotu Electron — 多链签名抽象层（主进程专用）
// ============================================================================
// 将不同链的签名逻辑收敛为统一的 ChainSigner 接口，
// 由 SignerFactory 按 chain 类型派发到具体实现。
// 新增链只需添加一个实现类 + 注册到 factory。
//
// 链 SDK（ethers / @solana/web3.js / bitcoinjs-lib）均为**可选依赖**，
// 只在对应链首次调用时延迟 require。未安装时给出明确错误提示。
// ============================================================================

import type { ChainType } from '../ipc/channels.js';

// ─── 通用接口 ──────────────────────────────────────────────────────

export interface ChainSigner {
    readonly chain: ChainType;
    deriveAddress(secret: string): Promise<string>;
    signTransaction(txPayload: string, secret: string): Promise<{ signedTx: string; txHash: string }>;
    signMessage(message: string, secret: string): Promise<string>;
}

// ─── 辅助：安全动态引入（链 SDK 未安装时给出明确提示） ─────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryImport(pkg: string): Promise<any> {
    try {
        return await import(pkg);
    } catch {
        throw new Error(
            `链 SDK "${pkg}" 未安装。请运行 cd electron && npm install ${pkg} --save 后重试。`
        );
    }
}

// ─── EVM 签名器（ethers.js v6） ─────────────────────────────────

export class EvmSigner implements ChainSigner {
    readonly chain: ChainType = 'evm';

    async deriveAddress(secret: string): Promise<string> {
        const ethers = await tryImport('ethers');
        const wallet = new ethers.Wallet(secret);
        return wallet.address;
    }

    async signTransaction(txPayload: string, secret: string): Promise<{ signedTx: string; txHash: string }> {
        const ethers = await tryImport('ethers');
        const wallet = new ethers.Wallet(secret);
        const tx = ethers.Transaction.from(JSON.parse(txPayload));
        const signedTx: string = await wallet.signTransaction(tx);
        const parsed = ethers.Transaction.from(signedTx);
        return { signedTx, txHash: parsed.hash ?? '' };
    }

    async signMessage(message: string, secret: string): Promise<string> {
        const ethers = await tryImport('ethers');
        const wallet = new ethers.Wallet(secret);
        return wallet.signMessage(message) as Promise<string>;
    }
}

// ─── Solana 签名器（@solana/web3.js） ──────────────────────────

export class SolanaSigner implements ChainSigner {
    readonly chain: ChainType = 'solana';

    async deriveAddress(secret: string): Promise<string> {
        const solana = await tryImport('@solana/web3.js');
        const secretKey = Uint8Array.from(Buffer.from(secret, 'hex'));
        const keypair = solana.Keypair.fromSecretKey(secretKey);
        return keypair.publicKey.toBase58();
    }

    async signTransaction(txPayload: string, secret: string): Promise<{ signedTx: string; txHash: string }> {
        const solana = await tryImport('@solana/web3.js');
        const secretKey = Uint8Array.from(Buffer.from(secret, 'hex'));
        const keypair = solana.Keypair.fromSecretKey(secretKey);
        const tx = solana.Transaction.from(Buffer.from(txPayload, 'base64'));
        tx.sign(keypair);
        const signedTx = tx.serialize().toString('base64');
        const txHash = tx.signature ? Buffer.from(tx.signature).toString('base64') : '';
        return { signedTx, txHash };
    }

    async signMessage(message: string, secret: string): Promise<string> {
        const solana = await tryImport('@solana/web3.js');
        const nacl = await tryImport('tweetnacl');
        const secretKey = Uint8Array.from(Buffer.from(secret, 'hex'));
        const keypair = solana.Keypair.fromSecretKey(secretKey);
        const msgBytes = new TextEncoder().encode(message);
        const signature = nacl.sign.detached(msgBytes, keypair.secretKey);
        return Buffer.from(signature).toString('hex');
    }
}

// ─── Bitcoin 签名器（bitcoinjs-lib） ──────────────────────────────

export class BitcoinSigner implements ChainSigner {
    readonly chain: ChainType = 'bitcoin';

    async deriveAddress(secret: string): Promise<string> {
        const bitcoin = await tryImport('bitcoinjs-lib');
        const ecc = await tryImport('tiny-secp256k1');
        const { ECPairFactory } = await tryImport('ecpair');
        const ECPair = ECPairFactory(ecc);
        const keyPair = ECPair.fromPrivateKey(Buffer.from(secret, 'hex'));
        const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey) });
        if (!address) throw new Error('Failed to derive Bitcoin address');
        return address;
    }

    async signTransaction(txPayload: string, secret: string): Promise<{ signedTx: string; txHash: string }> {
        const bitcoin = await tryImport('bitcoinjs-lib');
        const ecc = await tryImport('tiny-secp256k1');
        const { ECPairFactory } = await tryImport('ecpair');
        const ECPair = ECPairFactory(ecc);
        const keyPair = ECPair.fromPrivateKey(Buffer.from(secret, 'hex'));
        const psbt = bitcoin.Psbt.fromBase64(txPayload);
        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        const tx = psbt.extractTransaction();
        return { signedTx: tx.toHex(), txHash: tx.getId() };
    }

    async signMessage(message: string, secret: string): Promise<string> {
        const nodeCrypto = await import('node:crypto');
        const sign = nodeCrypto.createSign('SHA256');
        sign.update(message);
        const signature = sign.sign(Buffer.from(secret, 'hex'));
        return signature.toString('hex');
    }
}

// ─── 签名器工厂 ──────────────────────────────────────────────────

const SIGNERS: Record<ChainType, ChainSigner> = {
    evm:     new EvmSigner(),
    solana:  new SolanaSigner(),
    bitcoin: new BitcoinSigner(),
};

export function getSigner(chain: ChainType): ChainSigner {
    const signer = SIGNERS[chain];
    if (!signer) throw new Error(`Unsupported chain: ${chain}`);
    return signer;
}
