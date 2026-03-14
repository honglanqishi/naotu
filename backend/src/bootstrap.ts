/**
 * 全局代理配置（bootstrap - 需要作为第二个 import 加载在 index.ts 中）
 *
 * Node.js 的 undici（内置 fetch 底层）默认不读取系统代理，
 * 国内本地开发时无法直连 Google OAuth 等境外服务。
 *
 * 在 .env 中设置 HTTPS_PROXY 启用代理：
 *   HTTPS_PROXY=http://127.0.0.1:7890   # Clash 默认端口
 *   HTTPS_PROXY=http://127.0.0.1:10809  # v2ray 常见端口
 */

const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;

if (httpsProxy && process.env.NODE_ENV !== 'production') {
    // 仅本地开发环境设置代理（用于翻墙访问 Google OAuth）
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    const proxyAgent = new ProxyAgent(httpsProxy);
    setGlobalDispatcher(proxyAgent);
    console.log(`[proxy] HTTPS proxy enabled: ${httpsProxy}`);
} else if (httpsProxy && process.env.NODE_ENV === 'production') {
    // 生产环境警告但不设置 — 防止 Vercel 上 Neon 查询被路由到不存在的代理
    console.warn(`[proxy] WARNING: HTTPS_PROXY is set in production (${httpsProxy}) but IGNORED to prevent Neon HTTP driver hang`);
} else if (process.env.NODE_ENV !== 'production') {
    console.log('[proxy] No HTTPS_PROXY set. If Google OAuth fails, add HTTPS_PROXY=http://127.0.0.1:7890 to .env');
}

export {};
