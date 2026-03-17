import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardContent } from './DashboardContent';
import type { MindMap } from '@/hooks/useMindMaps';

const mockPush = jest.fn();
const mockCreateMap = jest.fn();
const mockDeleteMap = jest.fn();
const mockUseMindMaps = jest.fn();
const mockUseAuthRedirect = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useMindMaps', () => ({
    useMindMaps: () => mockUseMindMaps(),
}));

jest.mock('@/hooks/useAuthRedirect', () => ({
    useAuthRedirect: () => mockUseAuthRedirect(),
    getUserInitials: (name?: string | null) => {
        if (!name) return '?';
        return name.slice(0, 2).toUpperCase();
    },
}));

function createMindMap(overrides: Partial<MindMap> = {}): MindMap {
    return {
        id: 'map-1',
        title: '产品规划',
        description: '季度目标拆解',
        createdAt: '2026-03-10T10:00:00.000Z',
        updatedAt: '2026-03-14T10:00:00.000Z',
        ...overrides,
    };
}

function getCardMenuButton(title: string): HTMLButtonElement {
    const titleNode = screen.getByText(title);
    const card = titleNode.closest('div[class*="backdrop-blur"]');
    if (!card) {
        throw new Error(`Card container not found for map title: ${title}`);
    }

    const menuButton = card.querySelector('button');
    if (!(menuButton instanceof HTMLButtonElement)) {
        throw new Error(`Menu button not found for map title: ${title}`);
    }

    return menuButton;
}

function arrangeDashboard(options?: {
    maps?: MindMap[];
    isLoading?: boolean;
    isError?: boolean;
    isCreating?: boolean;
    isDeleting?: boolean;
}) {
    mockUseAuthRedirect.mockReturnValue({
        session: {
            user: {
                name: 'Alice',
                email: 'alice@example.com',
            },
        },
        isPending: false,
    });

    mockUseMindMaps.mockReturnValue({
        maps: options?.maps ?? [],
        isLoading: options?.isLoading ?? false,
        isError: options?.isError ?? false,
        createMap: mockCreateMap,
        isCreating: options?.isCreating ?? false,
        deleteMap: mockDeleteMap,
        isDeleting: options?.isDeleting ?? false,
    });

    return render(<DashboardContent />);
}

describe('DashboardContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders loading skeletons while maps are loading', () => {
        const { container } = arrangeDashboard({ isLoading: true });

        expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
        expect(screen.queryByText('脑图加载失败')).not.toBeInTheDocument();
    });

    it('renders the error state when loading maps fails', () => {
        arrangeDashboard({ isError: true });

        expect(screen.getByText('脑图加载失败')).toBeInTheDocument();
        expect(screen.getByText('请检查网络连接后刷新页面，或稍后重试。')).toBeInTheDocument();
    });

    it('renders the empty state and opens the create dialog from the CTA', async () => {
        const user = userEvent.setup();
        arrangeDashboard({ maps: [] });

        expect(screen.getByText('还没有脑图')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '立即创建' }));

        expect(screen.getByRole('heading', { name: '新建脑图' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('例：产品路线图 Q2')).toBeInTheDocument();
    });

    it('creates a map with trimmed values and only closes the modal after onSuccess', async () => {
        const user = userEvent.setup();
        const map = createMindMap();
        let capturedOnSuccess: (() => void) | undefined;

        mockCreateMap.mockImplementation((payload: unknown, options?: { onSuccess?: () => void }) => {
            capturedOnSuccess = options?.onSuccess;
        });

        arrangeDashboard({ maps: [map] });

        await user.click(screen.getByRole('button', { name: '新建脑图' }));
        await user.type(screen.getByPlaceholderText('例：产品路线图 Q2'), '  新增路线图  ');
        await user.type(screen.getByPlaceholderText('简要描述这张脑图的用途...'), '  补充说明  ');
        await user.click(screen.getByRole('button', { name: '创建脑图' }));

        expect(mockCreateMap).toHaveBeenCalledWith(
            { title: '新增路线图', description: '补充说明' },
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
        expect(screen.getByRole('heading', { name: '新建脑图' })).toBeInTheDocument();

        await act(async () => {
            capturedOnSuccess?.();
        });

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: '新建脑图' })).not.toBeInTheDocument();
        });
    });

    it('opens the delete confirmation from a card menu and closes it only after onSuccess', async () => {
        const user = userEvent.setup();
        const map = createMindMap({ id: 'map-delete', title: '待删除脑图' });
        let capturedDeleteSuccess: (() => void) | undefined;

        mockDeleteMap.mockImplementation((id: string, options?: { onSuccess?: () => void }) => {
            capturedDeleteSuccess = options?.onSuccess;
        });

        arrangeDashboard({ maps: [map] });

        await user.click(getCardMenuButton('待删除脑图'));
        await user.click(screen.getByText('删除'));

        expect(
            screen.getByText((_, element) =>
                element?.textContent === '确定要删除「待删除脑图」吗？此操作不可恢复。'
            )
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '确认删除' }));

        expect(mockDeleteMap).toHaveBeenCalledWith(
            'map-delete',
            expect.objectContaining({ onSuccess: expect.any(Function) }),
        );
        expect(screen.getByRole('heading', { name: '删除脑图' })).toBeInTheDocument();

        await act(async () => {
            capturedDeleteSuccess?.();
        });

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: '删除脑图' })).not.toBeInTheDocument();
        });
    });

    it('renders existing maps and navigates to a map when a card is clicked', async () => {
        const user = userEvent.setup();
        const map = createMindMap({ id: 'map-open', title: '路线图' });

        arrangeDashboard({ maps: [map] });

        await user.click(screen.getByText('路线图'));

        expect(mockPush).toHaveBeenCalledWith('/map/map-open');
    });
});