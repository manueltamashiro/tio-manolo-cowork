import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SessionList } from '../SessionList';
import type { Session } from '@/lib/types/chat';

// Mock fetch globally
global.fetch = vi.fn();

describe('SessionList Component', () => {
  const mockSessions: Session[] = [
    {
      id: 'session-1',
      title: 'First Conversation',
      createdAt: Date.now() - 1000 * 60 * 5, // 5 minutes ago
      updatedAt: Date.now() - 1000 * 60 * 5,
      messages: [],
      lastMessagePreview: 'Hello, how are you?',
    },
    {
      id: 'session-2',
      title: 'Second Conversation',
      createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
      updatedAt: Date.now() - 1000 * 60 * 60 * 2,
      messages: [],
      lastMessagePreview: 'Help me with coding',
    },
    {
      id: 'session-3',
      title: 'Third Conversation',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
      messages: [],
      lastMessagePreview: 'Thanks for the help',
    },
  ];

  const defaultProps = {
    currentSessionId: null,
    onSessionSelect: vi.fn(),
    onNewSession: vi.fn(),
    onSessionDelete: vi.fn(),
    onSessionRename: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch for sessions
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ sessions: mockSessions }),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render new chat button', () => {
      render(<SessionList {...defaultProps} />);

      expect(screen.getByText('New Chat')).toBeInTheDocument();
    });

    it('should render search input', () => {
      render(<SessionList {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
    });

    it('should render loading state initially', () => {
      // Mock a delayed response
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ sessions: mockSessions }),
              });
            }, 100);
          })
      );

      render(<SessionList {...defaultProps} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render sessions after loading', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('First Conversation')).toBeInTheDocument();
      expect(screen.getByText('Second Conversation')).toBeInTheDocument();
      expect(screen.getByText('Third Conversation')).toBeInTheDocument();
    });

    it('should render empty state when no sessions', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [] }),
      });

      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No conversations yet')).toBeInTheDocument();
      });
    });

    it('should render message previews', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onNewSession when New Chat button is clicked', () => {
      render(<SessionList {...defaultProps} />);

      const newChatButton = screen.getByText('New Chat');
      fireEvent.click(newChatButton);

      expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1);
    });

    it('should call onSessionSelect when a session is clicked', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.click(sessionItem!);

      expect(defaultProps.onSessionSelect).toHaveBeenCalledWith('session-1');
    });

    it('should highlight current session', async () => {
      render(<SessionList {...defaultProps} currentSessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="bg-neutral-800"]');
      expect(sessionItem).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter sessions by title', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'First' } });

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
        expect(screen.queryByText('Second Conversation')).not.toBeInTheDocument();
        expect(screen.queryByText('Third Conversation')).not.toBeInTheDocument();
      });
    });

    it('should filter sessions by message preview', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'coding' } });

      await waitFor(() => {
        expect(screen.queryByText('First Conversation')).not.toBeInTheDocument();
        expect(screen.getByText('Second Conversation')).toBeInTheDocument();
        expect(screen.queryByText('Third Conversation')).not.toBeInTheDocument();
      });
    });

    it('should show result count when searching', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'Conversation' } });

      await waitFor(() => {
        expect(screen.getByText('3 results')).toBeInTheDocument();
      });
    });

    it('should show no results message when search matches nothing', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search conversations...');
      fireEvent.change(searchInput, { target: { value: 'xyz123' } });

      await waitFor(() => {
        expect(screen.getByText('No matching conversations')).toBeInTheDocument();
      });
    });

    it('should clear search when X button is clicked', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search conversations...') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'First' } });

      await waitFor(() => {
        expect(screen.queryByText('Second Conversation')).not.toBeInTheDocument();
      });

      // Find and click the clear button (X icon)
      const clearButton = searchInput.parentElement?.querySelector('button');
      if (clearButton) {
        fireEvent.click(clearButton);
      }

      await waitFor(() => {
        expect(searchInput.value).toBe('');
        expect(screen.getByText('Second Conversation')).toBeInTheDocument();
      });
    });
  });

  describe('Session Actions', () => {
    it('should show edit and delete buttons on hover', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      // Edit and delete buttons should be visible
      const editButtons = sessionItem!.querySelectorAll('button');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should start editing when edit button is clicked', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      // Find edit button (lucide-edit-2)
      const editButton = sessionItem!.querySelector('button:nth-child(1)');
      if (editButton) {
        fireEvent.click(editButton);
      }

      // Should show input field
      const input = screen.getByDisplayValue('First Conversation');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should save edit on Enter key', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      const editButton = sessionItem!.querySelector('button:nth-child(1)');
      if (editButton) {
        fireEvent.click(editButton);
      }

      const input = screen.getByDisplayValue('First Conversation');
      fireEvent.change(input, { target: { value: 'Updated Title' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // Wait for update
      await waitFor(() => {
        expect(screen.getByText('Updated Title')).toBeInTheDocument();
      });
    });

    it('should cancel edit on Escape key', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      const editButton = sessionItem!.querySelector('button:nth-child(1)');
      if (editButton) {
        fireEvent.click(editButton);
      }

      const input = screen.getByDisplayValue('First Conversation');
      fireEvent.change(input, { target: { value: 'Changed Title' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Original title should remain
      expect(screen.getByText('First Conversation')).toBeInTheDocument();
      expect(screen.queryByText('Changed Title')).not.toBeInTheDocument();
    });
  });

  describe('Delete Session', () => {
    it('should show confirmation dialog before delete', async () => {
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      // Find delete button (trash icon)
      const deleteButton = sessionItem!.querySelector('button:nth-child(2)');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(confirmSpy).toHaveBeenCalledWith('Delete this conversation?');

      confirmSpy.mockRestore();
    });

    it('should delete session when confirmed', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<SessionList {...defaultProps} currentSessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      const deleteButton = sessionItem!.querySelector('button:nth-child(2)');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      await waitFor(() => {
        expect(defaultProps.onSessionDelete).toHaveBeenCalledWith('session-1');
      });

      confirmSpy.mockRestore();
    });

    it('should not delete session when cancelled', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      const sessionItem = screen.getByText('First Conversation').closest('[class*="group"]');
      fireEvent.mouseEnter(sessionItem!);

      const deleteButton = sessionItem!.querySelector('button:nth-child(2)');
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(defaultProps.onSessionDelete).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format timestamps correctly', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('First Conversation')).toBeInTheDocument();
      });

      // Should show "5m ago" for 5 minutes old session
      expect(screen.getByText('5m ago')).toBeInTheDocument();

      // Should show "2h ago" for 2 hours old session
      expect(screen.getByText('2h ago')).toBeInTheDocument();

      // Should show "3d ago" for 3 days old session
      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });
  });

  describe('Ref Methods', () => {
    it('should expose focusSearch method via ref', async () => {
      let ref: any = null;

      render(
        <SessionList
          {...defaultProps}
          ref={(el) => {
            ref = el;
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
      });

      expect(ref).toBeDefined();
      expect(typeof ref.focusSearch).toBe('function');

      const searchInput = screen.getByPlaceholderText('Search conversations...');

      ref.focusSearch();

      // Check if input is focused
      expect(searchInput).toHaveFocus();
    });
  });

  describe('Search Input Focus States', () => {
    it('should apply focused styles when search input is focused', async () => {
      render(<SessionList {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
      });

      const searchContainer = screen.getByPlaceholderText('Search conversations...').parentElement;

      fireEvent.focus(screen.getByPlaceholderText('Search conversations...'));

      expect(searchContainer).toHaveClass('ring-1', 'ring-blue-500');
    });
  });
});
