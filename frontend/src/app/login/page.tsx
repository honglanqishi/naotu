/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
    title: '登录',
};

export default function LoginPage() {
    return (
        <main
            className="relative w-full h-[100dvh] overflow-hidden flex flex-col items-center justify-center px-4 py-6 sm:px-6"
            style={{
                /* Figma: 2:173 - 精确渐变背景 */
                backgroundImage: 'linear-gradient(-60.6422deg, rgb(15, 12, 41) 0%, rgb(48, 43, 99) 50%, rgb(36, 36, 62) 100%)',
            }}
        >
            {/* Figma: 2:174 - 蓝/青色波浪（底部中左）inset: 73.47% 66.42% 12.49% 21.67% */}
            <div
                className="absolute pointer-events-none hidden sm:block"
                style={{ top: '73.47%', right: '66.42%', bottom: '12.49%', left: '21.67%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-174.svg" />
            </div>

            {/* Figma: 2:1177 - 蓝/青S形波浪（中左）inset: 59.48% 57.86% 6.31% 22.9% */}
            <div
                className="absolute pointer-events-none hidden sm:block"
                style={{ top: '59.48%', right: '57.86%', bottom: '6.31%', left: '22.9%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-1177.svg" />
            </div>

            {/* Figma: 2:2180 - 蓝色圆弧（顶部居中，旋转-114.31deg）inset: -13.43% 59.28% 88.44% 26.67% */}
            <div
                className="absolute items-center justify-center pointer-events-none hidden md:flex"
                style={{ top: '-13.43%', right: '59.28%', bottom: '88.44%', left: '26.67%' }}
            >
                <div style={{ flexShrink: 0, transform: 'rotate(-114.31deg)', width: '203.949px', height: '203.949px' }}>
                    <div className="relative w-full h-full">
                        <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-2180.svg" />
                    </div>
                </div>
            </div>

            {/* Figma: 2:3183 - 粉红色缎带（右侧）inset: 10.28% 15.3% 32.06% 49.9% */}
            <div
                className="absolute pointer-events-none hidden md:block"
                style={{ top: '10.28%', right: '15.3%', bottom: '32.06%', left: '49.9%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-3183.svg" />
            </div>

            {/* Figma: 2:4225 - 绿色波浪（中左，带额外内边距修正）inset: 28.25% 65.42% 59.47% 21.84% */}
            <div
                className="absolute pointer-events-none hidden md:block"
                style={{ top: '28.25%', right: '65.42%', bottom: '59.47%', left: '21.84%' }}
            >
                <div style={{ position: 'absolute', top: '-8.3%', right: '-6.13%', bottom: '-14.33%', left: '-6.13%' }}>
                    <img alt="" className="block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-4225.svg" />
                </div>
            </div>

            {/* Figma: 2:5228 - 绿色闪电波浪（左侧）inset: 42.82% 71.82% 49.35% 20.06% */}
            <div
                className="absolute pointer-events-none hidden lg:block"
                style={{ top: '42.82%', right: '71.82%', bottom: '49.35%', left: '20.06%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-5228.svg" />
            </div>

            {/* Figma: 2:6231 - 青色云朵（右下）inset: 75.12% 20.16% 19.63% 70.66% */}
            <div
                className="absolute pointer-events-none hidden lg:block"
                style={{ top: '75.12%', right: '20.16%', bottom: '19.63%', left: '70.66%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-6231.svg" />
            </div>

            {/* Figma: 2:7234 - 青色云朵2（右下，带溢出修正）inset: 68.89% 24.52% 25.87% 66.3% */}
            <div
                className="absolute pointer-events-none hidden lg:block"
                style={{ top: '68.89%', right: '24.52%', bottom: '25.87%', left: '66.3%' }}
            >
                <div style={{ position: 'absolute', top: '-19.42%', right: '-8.51%', bottom: '-33.55%', left: '-8.51%' }}>
                    <img alt="" className="block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-7234.svg" />
                </div>
            </div>

            {/* Figma: 2:8237 - 深红色曲线（左下，部分超出视图）inset: 62.78% 78.58% -20.44% -13.39% */}
            <div
                className="absolute pointer-events-none hidden lg:block"
                style={{ top: '62.78%', right: '78.58%', bottom: '-20.44%', left: '-13.39%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-8237.svg" />
            </div>

            {/* Figma: 2:9240 - 青绿色形状（右下角，大部分超出视图）inset: 82.87% -22.61% -4.42% 84.95% */}
            <div
                className="absolute pointer-events-none hidden lg:block"
                style={{ top: '82.87%', right: '-22.61%', bottom: '-4.42%', left: '84.95%' }}
            >
                <img alt="" className="absolute block w-full h-full max-w-none" style={{ objectFit: 'fill' }} src="/images/node-2-9240.svg" />
            </div>

            <div className="relative z-[2] w-full flex justify-center">
                <Suspense fallback={<div className="text-white">Loading...</div>}>
                    <LoginForm />
                </Suspense>
            </div>
        </main>
    );
}
