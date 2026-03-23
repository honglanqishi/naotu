import { render, screen } from '@testing-library/react';
import IosSafariLabPage, { metadata } from './page';

jest.mock('@/components/labs/IosSafariBugsLab', () => ({
    IosSafariBugsLab: () => <div data-testid="ios-safari-bugs-lab-stub">ios safari lab</div>,
}));

describe('IosSafariLabPage', () => {
    it('exports the expected metadata title', () => {
        expect(metadata).toMatchObject({ title: 'iOS Safari Bug Lab' });
    });

    it('renders the ios safari bugs lab content', () => {
        render(<IosSafariLabPage />);

        expect(screen.getByTestId('ios-safari-bugs-lab-stub')).toBeInTheDocument();
    });
});
