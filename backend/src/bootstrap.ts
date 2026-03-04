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

if (httpsProxy) {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    const proxyAgent = new ProxyAgent(httpsProxy);
    setGlobalDispatcher(proxyAgent);
    console.log(`[proxy] HTTPS proxy enabled: ${httpsProxy}`);
} else if (process.env.NODE_ENV !== 'production') {
    console.log('[proxy] No HTTPS_PROXY set. If Google OAuth fails, add HTTPS_PROXY=http://127.0.0.1:7890 to .env');
}
