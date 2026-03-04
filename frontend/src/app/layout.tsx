import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
});

export const metadata: Metadata = {
    title: {
        template: '%s | Naotu · 脑图',
        default: 'Naotu · 个人知识思维导图',
    },
    description: '用思维导图管理你的个人知识体系，多端同步，云端存储',
    keywords: ['思维导图', '知识管理', '脑图', 'mind map'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh-CN" className={inter.variable}>
            <body className="bg-background text-foreground antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
