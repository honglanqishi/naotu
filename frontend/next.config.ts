import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',  // Docker 部署优化

    // API 请求代理
    // 本地开发：Next.js dev server 代理到 localhost:3001，避免跨域导致 cookie 失效
    // Vercel 生产：BACKEND_INTERNAL_URL 必须设置为后端 Vercel URL，
    //              否则回退到 localhost:3001（Vercel 上不存在，会 hang 30s 超时）
    async rewrites() {
        const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
        console.log(`[next.config] rewrites destination: ${backendUrl}`);
        return [
            {
                source: '/api/:path*',
                destination: `${backendUrl}/api/:path*`,
            },
            {
                source: '/auth/:path*',
                destination: `${backendUrl}/auth/:path*`,
            },
        ];
    },

    // 图片域名白名单（Google 头像）
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
                pathname: '/**',
            },
        ],
    },
};

export default nextConfig;
