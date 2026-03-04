import type { Metadata } from 'next';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export const metadata: Metadata = {
    title: '我的脑图',
};

export default function DashboardPage() {
    return <DashboardContent />;
}
