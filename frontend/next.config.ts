import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',  // Docker 部署优化

    // API 请求代理
    // Vercel 生产：由 app/auth/[...path]/route.ts 和 app/api/[...path]/route.ts 显式代理
    // 本地开发：Next.js dev server 通过 rewrites 代理到 localhost:3001
    async rewrites() {
        if (process.env.VERCEL) {
            // Vercel 环境：Route Handler 已接管 /auth/* 和 /api/* 代理
            return [];
        }
        const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
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
