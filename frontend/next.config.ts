import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',  // Docker 部署优化

    // API 请求代理
    // 使用服务端专用变量 BACKEND_INTERNAL_URL（不暴露给浏览器）
    // 生产环境：Nginx 直接路由 /api/ 和 /auth/ 到 backend，这里的 rewrite 不会生效
    // 本地开发：Next.js dev server 代理到 localhost:3001，避免跨域导致 cookie 失效
    async rewrites() {
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
