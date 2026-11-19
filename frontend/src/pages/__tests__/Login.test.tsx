import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import { apiService } from '../../services/api';
import { AuthProvider } from '../../context/AuthContext';

// Mock apiService methods
jest.mock('../../services/api', () => ({
  apiService: {
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    login: jest.fn(),
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

describe('Login Component - Email OTP Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with Email OTP mode selected by default', () => {
    renderLogin();

    // Verify Brand title & tabs
    expect(screen.getByText(/Question Answering Engine/i)).toBeInTheDocument();
    expect(screen.getByText(/Email OTP/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g. analyst@qasystem.com/i)).toBeInTheDocument();
    expect(screen.getByText(/Send 6-Digit Code/i)).toBeInTheDocument();
  });

  test('allows switching between Email OTP and Password tabs', () => {
    renderLogin();

    // Click Password tab
    const passwordTab = screen.getByRole('button', { name: /password/i });
    fireEvent.click(passwordTab);

    // Verify Password form elements appear
    expect(screen.getByLabelText(/^Username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();

    // Click Email OTP tab back
    const otpTab = screen.getByRole('button', { name: /email otp/i });
    fireEvent.click(otpTab);

    expect(screen.getByPlaceholderText(/e.g. analyst@qasystem.com/i)).toBeInTheDocument();
  });

  test('sends OTP code and transitions to 6-digit OTP entry screen', async () => {
    (apiService.sendOtp as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent to analyst@qasystem.com.',
      email: 'analyst@qasystem.com',
      expires_in_seconds: 300,
      cooldown_seconds: 60,
      dev_otp: '789123',
    });

    renderLogin();

    const emailInput = screen.getByPlaceholderText(/e.g. analyst@qasystem.com/i);
    fireEvent.change(emailInput, { target: { value: 'analyst@qasystem.com' } });

    const sendBtn = screen.getByRole('button', { name: /Send 6-Digit Code/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(apiService.sendOtp).toHaveBeenCalledWith('analyst@qasystem.com');
    });

    // Check transition to Step 2
    await waitFor(() => {
      expect(screen.getAllByText(/Verification Code/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/Digit 1/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Digit 6/i)).toBeInTheDocument();
      expect(screen.getByText(/789123/i)).toBeInTheDocument(); // dev preview code
      expect(screen.getByRole('button', { name: /Verify & Sign In/i })).toBeInTheDocument();
    });
  });

  test('verifies OTP code and signs in user', async () => {
    (apiService.sendOtp as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent to analyst@qasystem.com.',
      email: 'analyst@qasystem.com',
      expires_in_seconds: 300,
      cooldown_seconds: 60,
      dev_otp: '789123',
    });

    (apiService.verifyOtp as jest.Mock).mockResolvedValueOnce({
      access_token: 'fake-jwt-token-123',
      token_type: 'bearer',
      email: 'analyst@qasystem.com',
      username: 'analyst',
    });

    renderLogin();

    // 1. Send OTP
    const emailInput = screen.getByPlaceholderText(/e.g. analyst@qasystem.com/i);
    fireEvent.change(emailInput, { target: { value: 'analyst@qasystem.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send 6-Digit Code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Digit 1/i)).toBeInTheDocument();
    });

    // 2. Click dev auto-fill & verify
    const autoFillBtn = screen.getByText(/Click to auto-fill & verify instantly/i);
    fireEvent.click(autoFillBtn);

    await waitFor(() => {
      expect(apiService.verifyOtp).toHaveBeenCalledWith('analyst@qasystem.com', '789123');
    });
  });
});
