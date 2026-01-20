import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MessageContent } from '../MessageContent';
import type { ContentBlock } from '@/lib/types/chat';

// Mock the DiffViewer component
vi.mock('@/components/diff/DiffViewer', () => ({
  DiffViewer: ({ onClose, fileName }: { onClose: () => void; fileName: string }) => (
    <div data-testid="diff-viewer">
      <span>Diff for {fileName}</span>
      <button onClick={onClose}>Close Diff</button>
    </div>
  ),
}));

// Mock fetch
global.fetch = vi.fn();

describe('MessageContent Component', () => {
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

  describe('Rendering Text Content', () => {
    it('should render string content', () => {
      render(<MessageContent content="Hello, world!" />);

      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    it('should render ContentBlock array with text type', () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'First paragraph' },
        { type: 'text', text: 'Second paragraph' },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('First paragraph')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph')).toBeInTheDocument();
    });

    it('should render markdown headers', () => {
      const markdown = '# Heading 1\n\n## Heading 2\n\n### Heading 3';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });

    it('should render markdown lists', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render markdown ordered lists', () => {
      const markdown = '1. First\n2. Second\n3. Third';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should render markdown links', () => {
      const markdown = '[Link text](https://example.com)';

      render(<MessageContent content={markdown} />);

      const link = screen.getByRole('link', { name: 'Link text' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render markdown blockquotes', () => {
      const markdown = '> This is a quote';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('should render inline code', () => {
      const markdown = 'This has `inline code` in it.';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('inline code')).toBeInTheDocument();
    });

    it('should render code blocks with syntax highlighting', () => {
      const markdown = '```javascript\nconst x = 42;\n```';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('const x = 42;')).toBeInTheDocument();
    });
  });

  describe('Code Blocks', () => {
    it('should show language name in code block header', () => {
      const markdown = '```python\ndef hello():\n    pass\n```';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('should show "code" when no language specified', () => {
      const markdown = '```\nsome code\n```';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('code')).toBeInTheDocument();
    });

    it('should copy code to clipboard when copy button is clicked', async () => {
      const markdown = '```javascript\nconst test = true;\n```';

      render(<MessageContent content={markdown} />);

      const copyButton = screen.getByLabelText('Copy code to clipboard');
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('const test = true;');
    });

    it('should show "Copied!" message after copying', async () => {
      const markdown = '```javascript\nconst test = true;\n```';

      render(<MessageContent content={markdown} />);

      const copyButton = screen.getByLabelText('Copy code to clipboard');
      fireEvent.click(copyButton);

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('should reset copy state after 2 seconds', async () => {
      const markdown = '```javascript\nconst test = true;\n```';

      render(<MessageContent content={markdown} />);

      const copyButton = screen.getByLabelText('Copy code to clipboard');
      fireEvent.click(copyButton);

      expect(screen.getByText('Copied!')).toBeInTheDocument();

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Tool Use Blocks', () => {
    it('should render tool_use block', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { filePath: '/path/to/file.txt' },
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('read_file')).toBeInTheDocument();
    });

    it('should render tool input as JSON', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'write_file',
          input: { filePath: '/path/to/file.txt', content: 'Hello world' },
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('"filePath"')).toBeInTheDocument();
      expect(screen.getByText('"/path/to/file.txt"')).toBeInTheDocument();
    });
  });

  describe('Tool Result Blocks', () => {
    it('should render successful tool_result', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File content here',
          is_error: false,
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('Tool Result')).toBeInTheDocument();
      expect(screen.getByText('File content here')).toBeInTheDocument();
    });

    it('should render error tool_result', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'Error occurred',
          is_error: true,
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('Tool Error')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should show "View Diff" button for overwritten files with backup', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File written successfully',
          is_error: false,
          diffMetadata: {
            backupPath: '/backup/file.txt',
            filePath: '/current/file.txt',
            fileName: 'file.txt',
            action: 'overwritten',
          },
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('View Diff')).toBeInTheDocument();
    });

    it('should not show "View Diff" button for errors', () => {
      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'Error writing file',
          is_error: true,
          diffMetadata: {
            backupPath: '/backup/file.txt',
            filePath: '/current/file.txt',
            fileName: 'file.txt',
            action: 'overwritten',
          },
        },
      ];

      render(<MessageContent content={content} />);

      expect(screen.queryByText('View Diff')).not.toBeInTheDocument();
    });
  });

  describe('Image Blocks', () => {
    it('should render image block', () => {
      const content: ContentBlock[] = [
        {
          type: 'image',
          source: {
            type: 'url',
            url: 'https://example.com/image.png',
          },
        },
      ];

      render(<MessageContent content={content} />);

      const image = screen.getByAltText('Attached image') as HTMLImageElement;
      expect(image).toBeInTheDocument();
      expect(image.src).toBe('https://example.com/image.png');
    });
  });

  describe('Diff Viewer', () => {
    it('should open diff viewer when View Diff is clicked', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          originalContent: 'old content',
          newContent: 'new content',
          fileName: 'test.txt',
        }),
      });

      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File written',
          is_error: false,
          diffMetadata: {
            backupPath: '/backup/file.txt',
            filePath: '/current/file.txt',
            fileName: 'file.txt',
            action: 'overwritten',
          },
        },
      ];

      render(<MessageContent content={content} />);

      const viewDiffButton = screen.getByText('View Diff');
      fireEvent.click(viewDiffButton);

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
        expect(screen.getByText('Diff for file.txt')).toBeInTheDocument();
      });
    });

    it('should close diff viewer when close button is clicked', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          originalContent: 'old content',
          newContent: 'new content',
          fileName: 'test.txt',
        }),
      });

      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File written',
          is_error: false,
          diffMetadata: {
            backupPath: '/backup/file.txt',
            filePath: '/current/file.txt',
            fileName: 'file.txt',
            action: 'overwritten',
          },
        },
      ];

      render(<MessageContent content={content} />);

      const viewDiffButton = screen.getByText('View Diff');
      fireEvent.click(viewDiffButton);

      await waitFor(() => {
        expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close Diff');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
      });
    });

    it('should handle fetch error when loading diff', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as any).mockResolvedValue({
        ok: false,
        text: async () => 'Not found',
      });

      const content: ContentBlock[] = [
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File written',
          is_error: false,
          diffMetadata: {
            backupPath: '/backup/file.txt',
            filePath: '/current/file.txt',
            fileName: 'file.txt',
            action: 'overwritten',
          },
        },
      ];

      render(<MessageContent content={content} />);

      const viewDiffButton = screen.getByText('View Diff');
      fireEvent.click(viewDiffButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Diff viewer should not open on error
      expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Markdown Tables', () => {
    it('should render markdown tables', () => {
      const markdown = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
      `.trim();

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Header 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 2')).toBeInTheDocument();
      expect(screen.getByText('Cell 3')).toBeInTheDocument();
      expect(screen.getByText('Cell 4')).toBeInTheDocument();
    });
  });

  describe('Combined Content Blocks', () => {
    it('should render mixed content types', () => {
      const content: ContentBlock[] = [
        { type: 'text', text: 'Here is some text' },
        {
          type: 'tool_use',
          id: 'tool-1',
          name: 'read_file',
          input: { filePath: '/path/to/file.txt' },
        },
        {
          type: 'tool_result',
          toolUseId: 'tool-1',
          content: 'File content',
          is_error: false,
        },
        { type: 'text', text: 'And some more text' },
      ];

      render(<MessageContent content={content} />);

      expect(screen.getByText('Here is some text')).toBeInTheDocument();
      expect(screen.getByText('read_file')).toBeInTheDocument();
      expect(screen.getByText('Tool Result')).toBeInTheDocument();
      expect(screen.getByText('And some more text')).toBeInTheDocument();
    });
  });

  describe('Empty Content', () => {
    it('should render empty string', () => {
      const { container } = render(<MessageContent content="" />);

      expect(container.textContent).toBe('');
    });

    it('should render empty array', () => {
      const { container } = render(<MessageContent content={[]} />);

      expect(container.querySelector('.message-content')?.children).toHaveLength(0);
    });
  });

  describe('Special Characters and Escaping', () => {
    it('should render HTML special characters correctly', () => {
      const content = 'Special chars: < > & " \'';

      render(<MessageContent content={content} />);

      expect(screen.getByText(/Special chars:/)).toBeInTheDocument();
    });

    it('should render code with special characters', () => {
      const markdown = '```html\n<div class="test">&nbsp;</div>\n```';

      render(<MessageContent content={markdown} />);

      expect(screen.getByText('<div class="test">')).toBeInTheDocument();
    });
  });
});
