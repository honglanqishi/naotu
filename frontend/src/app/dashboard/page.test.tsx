import { render, screen } from '@testing-library/react';
import DashboardPage, { metadata } from './page';

jest.mock('@/components/dashboard/DashboardContent', () => ({
    DashboardContent: () => <div data-testid="dashboard-content-stub">dashboard content</div>,
}));

describe('DashboardPage', () => {
    it('exports the expected metadata title', () => {
        expect(metadata).toMatchObject({ title: '我的脑图' });
    });

    it('renders dashboard content', () => {
        render(<DashboardPage />);

        expect(screen.getByTestId('dashboard-content-stub')).toBeInTheDocument();
    });
});