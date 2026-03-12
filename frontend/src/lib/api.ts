import axios, { type AxiosResponse, type AxiosError } from 'axios';

// axios 实例，自动携带 cookie（better-auth session cookie）
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? '',
    withCredentials: true, // 关键：携带 httpOnly cookie
    headers: {
        'Content-Type': 'application/json',
    },
});

// 响应拦截器：处理 401
// 不再使用 window.location.href 强制硬刷新（会打断 React Query 后台请求和用户的编辑状态），
// 改为派发自定义事件，由 Providers 的全局监听器通过 Next.js router 做客户端软跳转。
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
        } else if (!error.response || error.response?.status === 500 || error.response?.status === 502 || error.response?.status === 504) {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:network_error'));
            }
        }
        return Promise.reject(error);
    }
);

