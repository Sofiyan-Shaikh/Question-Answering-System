import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import { apiService } from '../../services/api';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('../../services/api', () => ({
  apiService: {
    login: jest.fn(),
    register: jest.fn(),
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
  },
}));

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Login Component - Password & OTP Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders Sign In with email and password by default', () => {
    renderLogin();

    expect(screen.getByText(/Question Answering System/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sign In to Workspace$/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in with a 6-digit email code instead/i)).toBeInTheDocument();
  });

  test('submits email and password to login API', async () => {
    (apiService.login as jest.Mock).mockResolvedValueOnce({
      access_token: 'fake-jwt-token-123',
      token_type: 'bearer',
      email: 'analyst@qasystem.com',
      username: 'analyst',
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'analyst@qasystem.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign In to Workspace$/i }));

    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith({
        email: 'analyst@qasystem.com',
        password: 'password123',
      });
    });
  });

  test('supports passwordless email OTP sign-in flow', async () => {
    (apiService.sendOtp as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent to analyst@qasystem.com.',
      email: 'analyst@qasystem.com',
      expires_in_seconds: 300,
      cooldown_seconds: 60,
      dev_otp: '654321',
    });
    (apiService.verifyOtp as jest.Mock).mockResolvedValueOnce({
      access_token: 'otp-jwt-token',
      token_type: 'bearer',
      email: 'analyst@qasystem.com',
      username: 'analyst',
    });

    renderLogin();

    fireEvent.click(screen.getByText(/Sign in with a 6-digit email code instead/i));
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'analyst@qasystem.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send Verification Code/i }));

    await waitFor(() => {
      expect(apiService.sendOtp).toHaveBeenCalledWith('analyst@qasystem.com');
      expect(screen.getByLabelText(/Digit 1/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Auto-fill & verify/i));

    await waitFor(() => {
      expect(apiService.verifyOtp).toHaveBeenCalledWith('analyst@qasystem.com', '654321');
    });
  });

  test('supports Create Account with email OTP verification', async () => {
    (apiService.sendOtp as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent to newuser@example.com.',
      email: 'newuser@example.com',
      expires_in_seconds: 300,
      cooldown_seconds: 60,
      dev_otp: '123456',
    });
    (apiService.register as jest.Mock).mockResolvedValueOnce({
      access_token: 'new-jwt-token',
      token_type: 'bearer',
      email: 'newuser@example.com',
      username: 'newuser',
    });

    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'newuser@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue & Verify Email/i }));

    await waitFor(() => {
      expect(apiService.sendOtp).toHaveBeenCalledWith('newuser@example.com');
      expect(screen.getByLabelText(/Digit 1/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Auto-fill & verify/i));

    await waitFor(() => {
      expect(apiService.register).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'secret123',
        username: undefined,
        otp: '123456',
      });
    });
  });

  test('displays error message when login fails', async () => {
    (apiService.login as jest.Mock).mockRejectedValueOnce({
      response: { data: { detail: 'Incorrect email or password' } },
    });

    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /^Sign In to Workspace$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password');
    });
  });
});
