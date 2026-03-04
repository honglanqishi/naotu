import axios, { type AxiosResponse, type AxiosError } from 'axios';

// axios 实例，自动携带 cookie（better-auth session cookie）
export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    withCredentials: true, // 关键：携带 httpOnly cookie
    headers: {
        'Content-Type': 'application/json',
    },
});

// 响应拦截器：处理 401 自动跳登录
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

