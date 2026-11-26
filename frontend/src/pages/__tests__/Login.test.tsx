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

describe('Login Component - Email & Password Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders simple email and password login form without OTP', () => {
    renderLogin();

    expect(screen.getByText(/Question Answering Engine/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In & Open Workspace/i })).toBeInTheDocument();
    expect(screen.queryByText(/Email OTP/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Send 6-Digit Code/i)).not.toBeInTheDocument();
  });

  test('allows toggling password visibility and filling demo accounts', () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(/^Password$/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: /Show/i }));
    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByText(/admin@qasystem\.com/i));
    const emailInput = screen.getByLabelText(/^Email$/i) as HTMLInputElement;
    expect(emailInput.value).toBe('admin@qasystem.com');
  });

  test('submits email and password to login API', async () => {
    (apiService.login as jest.Mock).mockResolvedValueOnce({
      access_token: 'fake-jwt-token-123',
      token_type: 'bearer',
      email: 'analyst@qasystem.com',
      username: 'analyst',
    });

    renderLogin();

    const emailInput = screen.getByLabelText(/^Email$/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);

    fireEvent.change(emailInput, { target: { value: 'analyst@qasystem.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In & Open Workspace/i }));

    await waitFor(() => {
      expect(apiService.login).toHaveBeenCalledWith({
        email: 'analyst@qasystem.com',
        password: 'password123',
      });
    });
  });

  test('displays error message when login fails', async () => {
    (apiService.login as jest.Mock).mockRejectedValueOnce({
      response: { data: { detail: 'Incorrect email or password' } },
    });

    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /Sign In & Open Workspace/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password');
    });
  });
});
