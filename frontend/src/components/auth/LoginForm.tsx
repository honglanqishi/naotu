'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';
import { isDesktop, desktopGoogleLogin, onLoginSuccess } from '@/lib/desktop-ipc';
import { toast } from 'sonner';
import Image from 'next/image';
import { useAuthStore } from '@/store/authStore';

export function LoginForm() {
    // Google OAuth 的 loadingProvider 保留在全局 store（连接平台级），
    // 邮符1登录/注册的 pending 状态改用局部 useState 维护，避免全局状态交叉污染。
    const { loadingProvider, setAuthLoading } = useAuthStore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // 桌面端：监听主进程 OAuth 完成推送，自动跳转
    useEffect(() => {
        if (!isDesktop()) return;
        const unsubscribe = onLoginSuccess(() => {
            setAuthLoading(false);
            toast.success('Google 登录成功');
            router.push(callbackUrl);
        });
        return unsubscribe;
    }, [callbackUrl, router, setAuthLoading]);
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('请输入您的姓名');
            return;
        }
        setIsLoading(true);
        try {
            const result = await signUp.email({
                name: name.trim(),
                email,
                password,
                callbackURL: callbackUrl,
            });
            if (result?.error) {
                console.error('[Auth] Email sign-up error:', result.error);
                toast.error(result.error.message || '注册失败，请重试');
                setIsLoading(false);
            }
        } catch (err) {
            console.error('[Auth] Email sign-up exception:', err);
            toast.error('网络错误，请检查连接后重试');
            setIsLoading(false);
        }
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await signIn.email({
                email,
                password,
                callbackURL: callbackUrl,
            });
            if (result?.error) {
                console.error('[Auth] Email sign-in error:', result.error);
                toast.error(result.error.message || '邮箱或密码错误，请重试');
                setIsLoading(false);
            }
        } catch (err) {
            console.error('[Auth] Email sign-in exception:', err);
            toast.error('网络错误，请检查连接后重试');
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setAuthLoading(true, 'google');

        // 桌面端：通过主进程的 Loopback IP OAuth 流程
        if (isDesktop()) {
            try {
                const result = await desktopGoogleLogin();
                if (!result.success) {
                    toast.error(result.error || 'Google 登录失败，请重试');
                    setAuthLoading(false);
                }
                // 成功后由 onLoginSuccess 事件监听处理跳转
            } catch (err) {
                console.error('[Auth] Desktop Google login error:', err);
                toast.error('桌面端 Google 登录出错');
                setAuthLoading(false);
            }
            return;
        }

        // Web 端：使用 better-auth 的社交登录重定向
        try {
            const result = await signIn.social({
                provider: 'google',
                // 使用相对路径，避免本地端口漂移（3000/3002）导致 callback 域不一致
                callbackURL: callbackUrl,
            });
            if (result?.error) {
                console.error('[Auth] Google sign-in error:', result.error);
                toast.error(result.error.message || 'Google 登录失败，请重试');
                setAuthLoading(false);
            }
        } catch (err) {
            console.error('[Auth] Google sign-in exception:', err);
            toast.error('网络错误，请检查连接后重试');
            setAuthLoading(false);
        }
    };

    const toggleMode = () => {
        setIsSignUp((prev) => !prev);
        setName('');
        setEmail('');
        setPassword('');
    };

    return (
        <div
            className="relative w-full max-w-[690px] animate-fade-in bg-white/10 backdrop-blur-xl border-2 border-white/60 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] px-5 py-6 sm:px-10 sm:py-8 lg:px-[92px] lg:py-[44px] max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="flex flex-col">
                <p className="text-[18px] sm:text-[22px] lg:text-[24px] font-bold text-white leading-normal">
                    Your logo
                </p>

                <h1 className="text-[30px] sm:text-[34px] lg:text-[38px] font-bold text-white leading-normal mt-[2px]">
                    {isSignUp ? 'Register' : 'Login'}
                </h1>

                {isSignUp && (
                    <div className="mt-4 sm:mt-[18px]">
                        <label className="block text-[16px] sm:text-[18px] font-normal text-white leading-normal mb-[2px]">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your full name"
                            required
                            className="w-full h-12 sm:h-[50px] bg-white rounded-[10px] px-4 sm:px-[23px] text-[14px] font-normal outline-none border border-[#bcbec0] text-[#333]"
                        />
                    </div>
                )}

                <div className="mt-4 sm:mt-[18px]">
                    <label className="block text-[16px] sm:text-[18px] font-normal text-white leading-normal mb-[2px]">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="username@gmail.com"
                        required
                        className="w-full h-12 sm:h-[50px] bg-white rounded-[10px] px-4 sm:px-[23px] text-[14px] font-normal outline-none border border-[#bcbec0] text-[#333]"
                    />
                </div>

                <div className="mt-5 sm:mt-[25px]">
                    <label className="block text-[16px] sm:text-[18px] font-normal text-white leading-normal mb-[2px]">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            required
                            minLength={6}
                            className="w-full h-12 sm:h-[50px] bg-white rounded-[10px] px-4 sm:px-[23px] pr-12 text-[14px] font-normal outline-none border border-[#bcbec0] text-[#333]"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 cursor-pointer"
                        >
                            <Image
                                src="/icons/eye-hide.svg"
                                alt="Toggle password"
                                width={16}
                                height={16}
                            />
                        </button>
                    </div>
                </div>

                {!isSignUp && (
                    <p className="text-[12px] font-normal text-white leading-normal mt-3 sm:mt-[15px] cursor-pointer hover:underline">
                        Forgot Password?
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 sm:h-[50px] rounded-[10px] text-[18px] sm:text-[20px] font-bold text-white mt-7 sm:mt-[40px] cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed bg-[#bd0c47]"
                >
                    {isLoading
                        ? isSignUp ? 'Creating account...' : 'Signing in...'
                        : isSignUp ? 'Create Account' : 'Sign in'}
                </button>

                <p className="text-[14px] font-normal text-white leading-normal text-center mt-6 sm:mt-[30px]">
                    or continue with
                </p>

                <div className="flex justify-center mt-5 sm:mt-[26px]">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={!!loadingProvider}
                        className="flex items-center justify-center w-full max-w-[260px] h-12 sm:h-[50px] bg-white rounded-[10px] cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed gap-[8px] border border-[#bcbec0]"
                        aria-label="使用 Google 账号登录"
                    >
                        {loadingProvider === 'google' ? (
                            <span className="text-xs text-gray-500">登录中...</span>
                        ) : (
                            <>
                                <Image src="/icons/google.svg" alt="Google" width={24} height={24} />
                                <span className="text-[14px] text-gray-700 font-medium">Google</span>
                            </>
                        )}
                    </button>
                </div>

                <p className="text-[14px] font-normal text-white leading-normal text-center mt-6 sm:mt-[28px]">
                    {isSignUp ? 'Already have an account? ' : "Don't have an account yet? "}
                    <span
                        className="font-semibold cursor-pointer hover:underline"
                        onClick={toggleMode}
                    >
                        {isSignUp ? 'Sign in' : 'Register for free'}
                    </span>
                </p>
            </form>
        </div>
    );
}
