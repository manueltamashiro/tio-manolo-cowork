import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Toast, ToastContainer } from '../Toast';
import type { Toast as ToastType, ToastAction } from '@/lib/context/ToastContext';

describe('Toast Component', () => {
  const mockOnDismiss = vi.fn();
  const mockOnActionClick = vi.fn();

  beforeEach(() => {
    mockOnDismiss.mockClear();
    mockOnActionClick.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  const createMockToast = (overrides: Partial<ToastType> = {}): ToastType => ({
    id: 'test-toast-1',
    type: 'info',
    message: 'Test toast message',
    duration: 5000,
    createdAt: Date.now(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('should render a toast with message', () => {
      const toast = createMockToast();

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Test toast message')).toBeInTheDocument();
    });

    it('should render with correct role for accessibility', () => {
      const toast = createMockToast();

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should render aria-live polite for polite announcements', () => {
      const toast = createMockToast();

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('should render close button with proper aria-label', () => {
      const toast = createMockToast();

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      const closeButton = screen.getByLabelText('Dismiss notification');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Toast Variants', () => {
    it('should render success toast', () => {
      const toast = createMockToast({ type: 'success', message: 'Success message' });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('border-claude-success-500');
    });

    it('should render error toast', () => {
      const toast = createMockToast({ type: 'error', message: 'Error message' });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('border-claude-error-500');
    });

    it('should render warning toast', () => {
      const toast = createMockToast({ type: 'warning', message: 'Warning message' });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('border-claude-warning-500');
    });

    it('should render info toast', () => {
      const toast = createMockToast({ type: 'info', message: 'Info message' });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText('Info message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('border-claude-info-500');
    });
  });

  describe('User Interactions', () => {
    it('should call onDismiss when close button is clicked', () => {
      const toast = createMockToast();

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      const closeButton = screen.getByLabelText('Dismiss notification');
      fireEvent.click(closeButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
      expect(mockOnDismiss).toHaveBeenCalledWith('test-toast-1');
    });

    it('should render action buttons', () => {
      const actions: ToastAction[] = [
        { label: 'Retry', onClick: vi.fn() },
        { label: 'Cancel', onClick: vi.fn() },
      ];
      const toast = createMockToast({ actions });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} onActionClick={mockOnActionClick} />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call action onClick when action button is clicked', () => {
      const actionMock = vi.fn();
      const actions: ToastAction[] = [{ label: 'Retry', onClick: actionMock }];
      const toast = createMockToast({ actions });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} onActionClick={mockOnActionClick} />);

      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);

      expect(actionMock).toHaveBeenCalledTimes(1);
      expect(mockOnActionClick).toHaveBeenCalledWith(actions[0], 'test-toast-1');
    });

    it('should not render actions when actions array is empty', () => {
      const toast = createMockToast({ actions: [] });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      // Should not have any button elements except the close button
      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(1); // Only close button
    });
  });

  describe('Progress Bar', () => {
    it('should render progress bar when duration is greater than 0', () => {
      const toast = createMockToast({ duration: 3000 });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      // The progress bar is a div with a child div for the animation
      const progressBar = screen.getByRole('alert').querySelector('.bg-current.opacity-30');
      expect(progressBar).toBeInTheDocument();
    });

    it('should not render progress bar when duration is 0', () => {
      const toast = createMockToast({ duration: 0 });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      const progressBar = screen.getByRole('alert').querySelector('.bg-current.opacity-30');
      expect(progressBar).not.toBeInTheDocument();
    });

    it('should not render progress bar when duration is undefined', () => {
      const toast = createMockToast({ duration: undefined });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      const progressBar = screen.getByRole('alert').querySelector('.bg-current.opacity-30');
      expect(progressBar).not.toBeInTheDocument();
    });
  });

  describe('Toast Container', () => {
    it('should render multiple toasts', () => {
      const toasts: ToastType[] = [
        createMockToast({ id: 'toast-1', message: 'First toast' }),
        createMockToast({ id: 'toast-2', message: 'Second toast' }),
        createMockToast({ id: 'toast-3', message: 'Third toast' }),
      ];

      render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />
      );

      expect(screen.getByText('First toast')).toBeInTheDocument();
      expect(screen.getByText('Second toast')).toBeInTheDocument();
      expect(screen.getByText('Third toast')).toBeInTheDocument();
    });

    it('should not render anything when toasts array is empty', () => {
      const { container } = render(
        <ToastContainer toasts={[]} onDismiss={mockOnDismiss} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render with correct aria-label for region', () => {
      const toasts: ToastType[] = [createMockToast()];

      render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />
      );

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Toast notifications');
    });

    it('should call onDismiss with correct toast id', () => {
      const toasts: ToastType[] = [
        createMockToast({ id: 'toast-1', message: 'First toast' }),
        createMockToast({ id: 'toast-2', message: 'Second toast' }),
      ];

      render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />
      );

      const firstCloseButton = screen.getAllByLabelText('Dismiss notification')[0];
      fireEvent.click(firstCloseButton);

      expect(mockOnDismiss).toHaveBeenCalledWith('toast-1');
    });

    it('should apply position classes correctly for top-right', () => {
      const toasts: ToastType[] = [createMockToast()];

      const { container } = render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} position="top-right" />
      );

      const containerDiv = container.querySelector('.fixed.z-claude-toast');
      expect(containerDiv).toHaveClass('top-4', 'right-4', 'flex-col');
    });

    it('should apply position classes correctly for bottom-left', () => {
      const toasts: ToastType[] = [createMockToast()];

      const { container } = render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} position="bottom-left" />
      );

      const containerDiv = container.querySelector('.fixed.z-claude-toast');
      expect(containerDiv).toHaveClass('bottom-4', 'left-4', 'flex-col-reverse');
    });

    it('should apply position classes correctly for top-center', () => {
      const toasts: ToastType[] = [createMockToast()];

      const { container } = render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} position="top-center" />
      );

      const containerDiv = container.querySelector('.fixed.z-claude-toast');
      expect(containerDiv).toHaveClass('top-4', 'left-1/2', '-translate-x-1/2', 'flex-col');
    });
  });

  describe('Keyboard Shortcuts (Toast Container)', () => {
    it('should dismiss most recent toast on Escape key', () => {
      const toasts: ToastType[] = [
        createMockToast({ id: 'toast-1', message: 'First toast' }),
        createMockToast({ id: 'toast-2', message: 'Second toast' }),
      ];

      render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />
      );

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(mockOnDismiss).toHaveBeenCalledWith('toast-1'); // First (most recent) toast
    });

    it('should not dismiss toast when pressing other keys', () => {
      const toasts: ToastType[] = [createMockToast({ id: 'toast-1' })];

      render(
        <ToastContainer toasts={toasts} onDismiss={mockOnDismiss} />
      );

      fireEvent.keyDown(window, { key: 'Enter' });

      expect(mockOnDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Long Messages', () => {
    it('should handle very long messages without breaking layout', () => {
      const longMessage = 'A'.repeat(1000);
      const toast = createMockToast({ message: longMessage });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle messages with special characters', () => {
      const specialMessage = 'Message with <html> & "quotes" and \'apostrophes\'';
      const toast = createMockToast({ message: specialMessage });

      render(<Toast toast={toast} onDismiss={mockOnDismiss} />);

      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });
  });
});
