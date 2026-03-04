import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// =============================================
// 类型定义
// =============================================
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    image?: string | null;
}

interface AuthState {
    /** 当前登录用户（从 better-auth session 同步） */
    user: AuthUser | null;
    /** 认证操作（登录/登出）的加载状态 */
    isAuthLoading: boolean;
    /** 当前社交登录的 provider（用于显示对应 loading 状态） */
    loadingProvider: 'google' | 'github' | 'facebook' | null;
}

interface AuthActions {
    setUser: (user: AuthUser | null) => void;
    setAuthLoading: (loading: boolean, provider?: 'google' | 'github' | 'facebook' | null) => void;
    reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// =============================================
// 初始状态
// =============================================
const initialState: AuthState = {
    user: null,
    isAuthLoading: false,
    loadingProvider: null,
};

// =============================================
// Zustand Auth Store
// =============================================
export const useAuthStore = create<AuthStore>()(
    devtools(
        (set) => ({
            ...initialState,

            /** 同步 better-auth session 中的用户信息 */
            setUser: (user) =>
                set({ user }, false, 'auth/setUser'),

            /**
             * 设置认证加载状态
             * @param loading 是否加载中
             * @param provider 哪个社交登录 provider 正在加载（null 表示清除）
             */
            setAuthLoading: (isAuthLoading, provider = null) =>
                set(
                    { isAuthLoading, loadingProvider: isAuthLoading ? provider ?? null : null },
                    false,
                    'auth/setAuthLoading'
                ),

            /** 登出时重置 store */
            reset: () => set(initialState, false, 'auth/reset'),
        }),
        { name: 'naotu-auth-store' }
    )
);
