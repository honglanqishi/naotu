import { render, screen } from '@testing-library/react';
import LoginPage, { metadata } from './page';

jest.mock('@/components/auth/LoginForm', () => ({
    LoginForm: () => <div data-testid="login-form-stub">login form</div>,
}));

describe('LoginPage', () => {
    it('exports the expected metadata title', () => {
        expect(metadata).toMatchObject({ title: '登录' });
    });

    it('renders the login form inside the page shell', () => {
        const { container } = render(<LoginPage />);

        expect(screen.getByTestId('login-form-stub')).toBeInTheDocument();
        expect(container.querySelector('main')).toBeInTheDocument();
    });
});