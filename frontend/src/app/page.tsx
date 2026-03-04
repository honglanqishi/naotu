import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-client';

// 首页：已登录跳转 Dashboard，未登录跳转登录页
export default async function HomePage() {
    const session = await getSession();

    if (session?.data) {
        redirect('/dashboard');
    } else {
        redirect('/login');
    }
}
