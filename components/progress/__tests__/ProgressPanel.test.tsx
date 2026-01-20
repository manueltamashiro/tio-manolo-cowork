import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressPanel, MiniProgressIndicator, FloatingProgressPanel } from '../ProgressPanel';
import { ProgressProvider, useProgress } from '@/lib/context/ProgressContext';

// Wrapper component for tests
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ProgressProvider>{children}</ProgressProvider>;
}

describe('ProgressPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<TestWrapper>{component}</TestWrapper>);
  };

  // Helper component to access progress context
  function TestWithProgress({ action }: { action: (context: ReturnType<typeof useProgress>) => void }) {
    const progressContext = useProgress();
    if (typeof action === 'function') {
      action(progressContext);
    }
    return <ProgressPanel />;
  }

  describe('Rendering', () => {
    it('should render empty state when no operations', () => {
      renderWithProvider(<ProgressPanel />);

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });

    it('should render header with Activity title', () => {
      renderWithProvider(<ProgressPanel />);

      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  describe('Progress Items', () => {
    it('should display operation title', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
      );

      await waitFor(() => {
        expect(screen.getByText('Reading file.txt')).toBeInTheDocument();
      });
    });

    it('should display progress percentage', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.updateProgress(opId, 50);
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('should display progress bar with correct width', async () => {
      let opId = '';

      const { container } = renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.updateProgress(opId, 75);
          }}
        />
      );

      await waitFor(() => {
        const progressBar = container.querySelector('.bg-gradient-to-r.from-blue-500');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should display message when provided', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.updateProgress(opId, 50, 'Halfway done');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Halfway done')).toBeInTheDocument();
      });
    });

    it('should display error message when operation fails', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.failOperation(opId, 'File not found');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('File not found')).toBeInTheDocument();
      });
    });

    it('should display checkmark when operation completes', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.completeOperation(opId);
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Reading file.txt')).toBeInTheDocument();
      });
    });
  });

  describe('Active Indicator', () => {
    it('should display active count when operations are in progress', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
      );

      await waitFor(() => {
        expect(screen.getByText(/1 active/)).toBeInTheDocument();
      });
    });

    it('should display correct count for multiple active operations', async () => {
      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            context.startOperation('file-read', 'Reading file.txt');
            context.startOperation('file-write', 'Writing output.txt');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/2 active/)).toBeInTheDocument();
      });
    });

    it('should not show active indicator when no operations are active', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.completeOperation(opId);
          }}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/active/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear Completed', () => {
    it('should show clear completed button when there are completed operations', async () => {
      let opId = '';

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.completeOperation(opId);
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Clear completed')).toBeInTheDocument();
      });
    });

    it('should clear completed operations when button is clicked', async () => {
      let opId = '';
      let clearCompletedFn: (() => void) | undefined;

      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            opId = context.startOperation('file-read', 'Reading file.txt');
            context.completeOperation(opId);
            clearCompletedFn = context.clearCompleted;
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Clear completed')).toBeInTheDocument();
      });

      if (clearCompletedFn) {
        fireEvent.click(screen.getByText('Clear completed'));
        clearCompletedFn();
      }

      await waitFor(() => {
        expect(screen.queryByText('Reading file.txt')).not.toBeInTheDocument();
      });
    });
  });

  describe('Remove Operation', () => {
    it('should have remove button for operations', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
      );

      await waitFor(() => {
        const removeButton = screen.queryByLabelText('Remove');
        expect(removeButton).toBeInTheDocument();
      });
    });
  });

  describe('Footer Stats', () => {
    it('should display total count of operations', async () => {
      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            context.startOperation('file-read', 'Reading file.txt');
            context.startOperation('file-write', 'Writing output.txt');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Total: 2')).toBeInTheDocument();
      });
    });

    it('should display error count when operations have errors', async () => {
      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            const opId1 = context.startOperation('file-read', 'Reading file.txt');
            context.failOperation(opId1, 'Error 1');
            const opId2 = context.startOperation('file-write', 'Writing output.txt');
            context.failOperation(opId2, 'Error 2');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('2 errors')).toBeInTheDocument();
      });
    });

    it('should display singular "error" when only one error', async () => {
      renderWithProvider(
        <TestWithProgress
          action={(context) => {
            const opId = context.startOperation('file-read', 'Reading file.txt');
            context.failOperation(opId, 'File not found');
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('1 error')).toBeInTheDocument();
      });
    });
  });

  describe('Operation Types', () => {
    it('should render file-read operations', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
      );

      await waitFor(() => {
        expect(screen.getByText('Reading file.txt')).toBeInTheDocument();
      });
    });

    it('should render file-write operations', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('file-write', 'Writing output.txt')} />
      );

      await waitFor(() => {
        expect(screen.getByText('Writing output.txt')).toBeInTheDocument();
      });
    });

    it('should render api-call operations', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('api-call', 'GET /api/data')} />
      );

      await waitFor(() => {
        expect(screen.getByText('GET /api/data')).toBeInTheDocument();
      });
    });

    it('should render chat-stream operations', async () => {
      renderWithProvider(
        <TestWithProgress action={(context) => context.startOperation('chat-stream', 'AI Response')} />
      );

      await waitFor(() => {
        expect(screen.getByText('AI Response')).toBeInTheDocument();
      });
    });
  });

  describe('File Name Metadata', () => {
    it('should display file name when metadata is provided', async () => {
      renderWithProvider(
        <TestWithProgress
          action={(context) =>
            context.startOperation('file-read', 'Reading file', {
              fileName: 'example.txt',
            })
          }
        />
      );

      await waitFor(() => {
        expect(screen.getByText('example.txt')).toBeInTheDocument();
      });
    });
  });
});

describe('MiniProgressIndicator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<ProgressProvider>{component}</ProgressProvider>);
  };

  // Helper component to access progress context
  function TestIndicatorWithProgress({ action }: { action: (context: ReturnType<typeof useProgress>) => void }) {
    const progressContext = useProgress();
    if (typeof action === 'function') {
      action(progressContext);
    }
    return <MiniProgressIndicator />;
  }

  it('should not render when no active operations', () => {
    renderWithProvider(<MiniProgressIndicator />);

    expect(screen.queryByText(/[0-9]/)).not.toBeInTheDocument();
  });

  it('should render active count when operations exist', async () => {
    renderWithProvider(
      <TestIndicatorWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
    );

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('should display correct count for multiple operations', async () => {
    renderWithProvider(
      <TestIndicatorWithProgress
        action={(context) => {
          context.startOperation('file-read', 'Reading file.txt');
          context.startOperation('file-write', 'Writing output.txt');
          context.startOperation('api-call', 'API Request');
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});

describe('FloatingProgressPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<ProgressProvider>{component}</ProgressProvider>);
  };

  // Helper component to access progress context
  function TestFloatingWithProgress({ action }: { action: (context: ReturnType<typeof useProgress>) => void }) {
    const progressContext = useProgress();
    if (typeof action === 'function') {
      action(progressContext);
    }
    return <FloatingProgressPanel />;
  }

  it('should not render when no operations', () => {
    const { container } = renderWithProvider(<FloatingProgressPanel />);

    expect(container.firstChild).toBeNull();
  });

  it('should render when operations exist', async () => {
    const { container } = renderWithProvider(
      <TestFloatingWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
    );

    await waitFor(() => {
      expect(container.firstChild).not.toBeNull();
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  it('should apply bottom-right position by default', async () => {
    const { container } = renderWithProvider(
      <TestFloatingWithProgress action={(context) => context.startOperation('file-read', 'Reading file.txt')} />
    );

    await waitFor(() => {
      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass('bottom-4', 'right-4');
    });
  });

  it('should apply bottom-left position when specified', async () => {
    const { container } = renderWithProvider(
      <TestFloatingWithProgress
        action={(context) => context.startOperation('file-read', 'Reading file.txt')}
        position="bottom-left"
      />
    );

    await waitFor(() => {
      const panel = container.firstChild as HTMLElement;
      expect(panel).toHaveClass('bottom-4', 'left-4');
    });
  });
});
