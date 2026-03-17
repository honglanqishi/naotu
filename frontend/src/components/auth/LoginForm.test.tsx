import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

const mockPush = jest.fn();
const mockGet = jest.fn();
const mockSignInEmail = jest.fn();
const mockSignInSocial = jest.fn();
const mockSignUpEmail = jest.fn();
const mockDesktopGoogleLogin = jest.fn();
const mockOnLoginSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockSetAuthLoading = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} {...props} />,
}));

jest.mock('@/lib/auth-client', () => ({
    signIn: {
        email: (...args: unknown[]) => mockSignInEmail(...args),
        social: (...args: unknown[]) => mockSignInSocial(...args),
    },
    signUp: {
        email: (...args: unknown[]) => mockSignUpEmail(...args),
    },
}));

jest.mock('@/lib/desktop-ipc', () => ({
    isDesktop: jest.fn(),
    desktopGoogleLogin: (...args: unknown[]) => mockDesktopGoogleLogin(...args),
    onLoginSuccess: (...args: unknown[]) => mockOnLoginSuccess(...args),
}));

jest.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => mockToastError(...args),
        success: (...args: unknown[]) => mockToastSuccess(...args),
    },
}));

jest.mock('@/store/authStore', () => ({
    useAuthStore: () => ({
        loadingProvider: null,
        setAuthLoading: mockSetAuthLoading,
    }),
}));

const { isDesktop } = jest.requireMock('@/lib/desktop-ipc') as {
    isDesktop: jest.Mock;
};

describe('LoginForm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGet.mockReturnValue('/dashboard');
        isDesktop.mockReturnValue(false);
        mockOnLoginSuccess.mockReturnValue(jest.fn());
    });

    it('submits email sign-in with callback URL from search params', async () => {
        const user = userEvent.setup();
        mockSignInEmail.mockResolvedValue(undefined);

        render(<LoginForm />);

        await user.type(screen.getByPlaceholderText('username@gmail.com'), 'user@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'secret123');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => {
            expect(mockSignInEmail).toHaveBeenCalledWith({
                email: 'user@example.com',
                password: 'secret123',
                callbackURL: '/dashboard',
            });
        });
    });

    it('blocks sign-up when name is blank and shows a validation toast', async () => {
        const user = userEvent.setup();

        render(<LoginForm />);

        await user.click(screen.getByText('Register for free'));
        await user.type(screen.getByPlaceholderText('Your full name'), '   ');
        await user.type(screen.getByPlaceholderText('username@gmail.com'), 'signup@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'secret123');
        await user.click(screen.getByRole('button', { name: 'Create Account' }));

        expect(mockToastError).toHaveBeenCalledWith('请输入您的姓名');
        expect(mockSignUpEmail).not.toHaveBeenCalled();
    });

    it('submits sign-up with a trimmed name and resets the mode fields when toggled', async () => {
        const user = userEvent.setup();
        mockSignUpEmail.mockResolvedValue(undefined);
        mockGet.mockReturnValue('/dashboard?from=invite');

        render(<LoginForm />);

        await user.click(screen.getByText('Register for free'));
        await user.type(screen.getByPlaceholderText('Your full name'), '  Alice Zhang  ');
        await user.type(screen.getByPlaceholderText('username@gmail.com'), 'alice@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'secret123');
        await user.click(screen.getByRole('button', { name: 'Create Account' }));

        await waitFor(() => {
            expect(mockSignUpEmail).toHaveBeenCalledWith({
                name: 'Alice Zhang',
                email: 'alice@example.com',
                password: 'secret123',
                callbackURL: '/dashboard?from=invite',
            });
        });

        await user.click(screen.getByText('Sign in'));

        expect(screen.queryByPlaceholderText('Your full name')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('username@gmail.com')).toHaveValue('');
        expect(screen.getByPlaceholderText('Password')).toHaveValue('');
    });

    it('uses the web social login flow with a relative callback URL', async () => {
        const user = userEvent.setup();
        mockGet.mockReturnValue('/dashboard');
        mockSignInSocial.mockResolvedValue(undefined);

        render(<LoginForm />);

        await user.click(screen.getByRole('button', { name: '使用 Google 账号登录' }));

        await waitFor(() => {
            expect(mockSetAuthLoading).toHaveBeenCalledWith(true, 'google');
            expect(mockSignInSocial).toHaveBeenCalledWith({
                provider: 'google',
                callbackURL: '/dashboard',
            });
        });
    });

    it('handles desktop Google login success via the login success event channel', async () => {
        const user = userEvent.setup();
        const unsubscribe = jest.fn();
        let successCallback: (() => void) | undefined;

        isDesktop.mockReturnValue(true);
        mockGet.mockReturnValue('/special');
        mockDesktopGoogleLogin.mockResolvedValue({ success: true });
        mockOnLoginSuccess.mockImplementation((callback: () => void) => {
            successCallback = callback;
            return unsubscribe;
        });

        render(<LoginForm />);

        await user.click(screen.getByRole('button', { name: '使用 Google 账号登录' }));

        await waitFor(() => {
            expect(mockDesktopGoogleLogin).toHaveBeenCalled();
        });

        successCallback?.();

        expect(mockSetAuthLoading).toHaveBeenCalledWith(false);
        expect(mockToastSuccess).toHaveBeenCalledWith('Google 登录成功');
        expect(mockPush).toHaveBeenCalledWith('/special');
    });

    it('surfaces email sign-in errors and restores the default submit label', async () => {
        const user = userEvent.setup();
        mockSignInEmail.mockResolvedValue({ error: { message: '凭证无效' } });

        render(<LoginForm />);

        await user.type(screen.getByPlaceholderText('username@gmail.com'), 'user@example.com');
        await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');
        await user.click(screen.getByRole('button', { name: 'Sign in' }));

        await waitFor(() => {
            expect(mockToastError).toHaveBeenCalledWith('凭证无效');
        });

        expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    });
});