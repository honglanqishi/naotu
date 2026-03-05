'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';
import { toast } from 'sonner';
import Image from 'next/image';
import { useAuthStore } from '@/store/authStore';

export function LoginForm() {
    // Google OAuth 的 loadingProvider 保留在全局 store（连接平台级），
    // 邮符1登录/注册的 pending 状态改用局部 useState 维护，避免全局状态交叉污染。
    const { loadingProvider, setAuthLoading } = useAuthStore();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

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
        try {
            const result = await signIn.social({
                provider: 'google',
                callbackURL: `${window.location.origin}${callbackUrl}`,
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
            className="relative w-[690px] max-w-[95vw] animate-fade-in"
            style={{
                backdropFilter: 'blur(12.5px)',
                WebkitBackdropFilter: 'blur(12.5px)',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '3px solid rgba(255, 255, 255, 0.79)',
                borderRadius: '40px',
                padding: '45px 92px 44px',
            }}
        >
            <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="flex flex-col">
                <p className="text-[24px] font-bold text-white leading-normal">
                    Your logo
                </p>

                <h1 className="text-[38px] font-bold text-white leading-normal mt-[2px]">
                    {isSignUp ? 'Register' : 'Login'}
                </h1>

                {isSignUp && (
                    <div className="mt-[18px]">
                        <label className="block text-[18px] font-normal text-white leading-normal mb-[2px]">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your full name"
                            required
                            className="w-full h-[50px] bg-white rounded-[10px] px-[23px] text-[14px] font-normal outline-none"
                            style={{ border: '1px solid #bcbec0', color: '#333' }}
                        />
                    </div>
                )}

                <div className="mt-[18px]">
                    <label className="block text-[18px] font-normal text-white leading-normal mb-[2px]">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="username@gmail.com"
                        required
                        className="w-full h-[50px] bg-white rounded-[10px] px-[23px] text-[14px] font-normal outline-none"
                        style={{ border: '1px solid #bcbec0', color: '#333' }}
                    />
                </div>

                <div className="mt-[25px]">
                    <label className="block text-[18px] font-normal text-white leading-normal mb-[2px]">
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
                            className="w-full h-[50px] bg-white rounded-[10px] px-[23px] pr-[48px] text-[14px] font-normal outline-none"
                            style={{ border: '1px solid #bcbec0', color: '#333' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-[16px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] cursor-pointer"
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
                    <p className="text-[12px] font-normal text-white leading-normal mt-[15px] cursor-pointer hover:underline">
                        Forgot Password?
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-[50px] rounded-[10px] text-[20px] font-bold text-white mt-[40px] cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: '#bd0c47' }}
                >
                    {isLoading
                        ? isSignUp ? 'Creating account...' : 'Signing in...'
                        : isSignUp ? 'Create Account' : 'Sign in'}
                </button>

                <p className="text-[14px] font-normal text-white leading-normal text-center mt-[30px]">
                    or continue with
                </p>

                <div className="flex justify-center mt-[26px]">
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={!!loadingProvider}
                        className="flex items-center justify-center w-[200px] h-[50px] bg-white rounded-[10px] cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed gap-[8px]"
                        style={{ border: '1px solid #bcbec0' }}
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

                <p className="text-[14px] font-normal text-white leading-normal text-center mt-[28px]">
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
