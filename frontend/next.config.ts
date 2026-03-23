import * as path from 'node:path';
import withBundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

const withAnalyzer = withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
});

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
    output: 'standalone',  // Docker 部署优化
    // Turbopack dev 在 pnpm workspace 下会把 tracing root 当成项目根，
    // 进而错误地去仓库根查找 next 包。只在生产构建时开启 monorepo tracing root。
    ...(isDev ? {} : { outputFileTracingRoot: path.join(process.cwd(), '..') }),

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

export default withAnalyzer(nextConfig);
