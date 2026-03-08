/**
 * useMindMaps
 *
 * 封装脑图列表的查询、创建、删除三个操作。
 * DashboardContent 直接调用此 Hook，不再手写 useQuery/useMutation 样板代码。
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface MindMap {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export function useMindMaps() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const {
        data: maps = [],
        isLoading,
        isError,
    } = useQuery<MindMap[]>({
        queryKey: ['maps'],
        queryFn: async () => {
            const res = await api.get<{ maps: MindMap[] }>('/api/maps');
            return res.data.maps;
        },
    });

    const createMutation = useMutation({
        mutationFn: async ({ title, description }: { title: string; description?: string }) => {
            const res = await api.post<{ map: MindMap }>('/api/maps', { title, description });
            return res.data.map;
        },
        onSuccess: (newMap) => {
            queryClient.invalidateQueries({ queryKey: ['maps'] });
            toast.success('脑图创建成功');
            router.push(`/map/${newMap.id}`);
        },
        onError: () => toast.error('创建失败，请重试'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/api/maps/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['maps'] });
            toast.success('脑图已删除');
        },
        onError: () => toast.error('删除失败，请重试'),
    });

    return {
        maps,
        isLoading,
        isError,
        createMap: createMutation.mutate,
        isCreating: createMutation.isPending,
        deleteMap: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
    };
}
