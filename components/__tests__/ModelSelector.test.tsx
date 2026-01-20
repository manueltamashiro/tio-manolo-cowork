import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ModelSelector, ModelCard, ModelGrid } from '../ModelSelector';
import type { ModelId } from '@/types/claude';

describe('ModelSelector Component', () => {
  const mockOnModelChange = vi.fn();

  beforeEach(() => {
    mockOnModelChange.mockClear();
  });

  const defaultProps = {
    selectedModel: 'claude-3-5-sonnet-20241022' as ModelId,
    onModelChange: mockOnModelChange,
  };

  describe('ModelSelector (Dropdown)', () => {
    it('should render with default selected model', () => {
      render(<ModelSelector {...defaultProps} />);

      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude Model')).toBeInTheDocument();
    });

    it('should render tier badge for selected model', () => {
      render(<ModelSelector {...defaultProps} />);

      expect(screen.getByText('Balanced')).toBeInTheDocument();
    });

    it('should render dropdown when button is clicked', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Claude 3.5 Sonnet/ });
      fireEvent.click(button);

      // Should show all model names in dropdown
      expect(screen.getByText('Claude 3.7 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude 3.5 Haiku')).toBeInTheDocument();
      expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
    });

    it('should rotate chevron icon when dropdown is open', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      const chevron = button.querySelector('svg');

      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-180');

      fireEvent.click(button);

      // Should be rotated after click
      expect(chevron).toHaveClass('rotate-180');
    });

    it('should call onModelChange when a model is selected', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      const haikuOption = screen.getByText('Claude 3.5 Haiku').closest('button');
      fireEvent.click(haikuOption!);

      expect(mockOnModelChange).toHaveBeenCalledWith('claude-3-5-haiku-20241022');
    });

    it('should close dropdown after selection', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      const haikuOption = screen.getByText('Claude 3.5 Haiku').closest('button');
      fireEvent.click(haikuOption!);

      // Dropdown should be closed, clicking backdrop
      const backdrop = document.querySelector('.fixed.inset-0.z-10');
      expect(backdrop).not.toBeInTheDocument();
    });

    it('should highlight selected model in dropdown', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Find all model option buttons
      const modelButtons = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Claude')
      );

      // The selected model should have different styling (bg-zinc-700)
      const selectedButton = modelButtons.find(btn =>
        btn.textContent?.includes('Claude 3.5 Sonnet')
      );

      expect(selectedButton).toHaveClass('bg-zinc-700');
    });

    it('should disable button when disabled prop is true', () => {
      render(<ModelSelector {...defaultProps} disabled={true} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('should close dropdown when clicking outside', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Click the backdrop
      const backdrop = document.querySelector('.fixed.inset-0.z-10');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Dropdown should be closed
      expect(screen.queryByText('Claude 3.7 Sonnet')).not.toBeInTheDocument();
    });

    it('should display model description in dropdown', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByText(/Most intelligent model/)).toBeInTheDocument();
      expect(screen.getByText(/Balanced performance/)).toBeInTheDocument();
      expect(screen.getByText(/Fastest model/)).toBeInTheDocument();
    });

    it('should display model capabilities', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByText('Complex reasoning')).toBeInTheDocument();
      expect(screen.getByText('Balanced reasoning')).toBeInTheDocument();
      expect(screen.getByText('Quick responses')).toBeInTheDocument();
    });

    it('should display pricing information', () => {
      render(<ModelSelector {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByText(/\$15.0\/M tokens/)).toBeInTheDocument();
      expect(screen.getByText(/\$3.0\/M tokens/)).toBeInTheDocument();
      expect(screen.getByText(/\$0.8\/M tokens/)).toBeInTheDocument();
    });
  });

  describe('ModelCard Component', () => {
    const mockModel = {
      id: 'claude-3-5-sonnet-20241022' as ModelId,
      name: 'Claude 3.5 Sonnet',
      description: 'Balanced performance for most tasks with excellent speed and capability.',
      capabilities: ['Balanced reasoning', 'Strong coding', 'Efficient tool use', 'Fast responses'],
      contextWindow: 200000,
      inputPrice: 3.0,
      outputPrice: 15.0,
      maxTokens: 8192,
      tier: 'balanced' as const,
    };

    it('should render model name and description', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText(/Balanced performance/)).toBeInTheDocument();
    });

    it('should render tier badge', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Balanced')).toBeInTheDocument();
    });

    it('should render capabilities', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Balanced reasoning')).toBeInTheDocument();
      expect(screen.getByText('Strong coding')).toBeInTheDocument();
      expect(screen.getByText('Efficient tool use')).toBeInTheDocument();
      expect(screen.getByText('Fast responses')).toBeInTheDocument();
    });

    it('should render pricing information', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('$3.0/M')).toBeInTheDocument();
      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.getByText('$15/M')).toBeInTheDocument();
    });

    it('should render context window and max tokens', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Context:')).toBeInTheDocument();
      expect(screen.getByText('200,000')).toBeInTheDocument();
      expect(screen.getByText('Max tokens:')).toBeInTheDocument();
      expect(screen.getByText('8,192')).toBeInTheDocument();
    });

    it('should call onSelect when clicked', () => {
      const mockOnSelect = vi.fn();

      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={mockOnSelect}
        />
      );

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
    });

    it('should show selected state when isSelected is true', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={true}
          onSelect={vi.fn()}
        />
      );

      expect(screen.getByText('Selected')).toBeInTheDocument();
      const card = screen.getByRole('button');
      expect(card).toHaveClass('bg-blue-900/30', 'border-blue-700');
    });

    it('should not show selected state when isSelected is false', () => {
      render(
        <ModelCard
          model={mockModel}
          isSelected={false}
          onSelect={vi.fn()}
        />
      );

      expect(screen.queryByText('Selected')).not.toBeInTheDocument();
    });

    it('should apply different tier badge colors', () => {
      const flagshipModel = { ...mockModel, tier: 'flagship' as const };
      const fastModel = { ...mockModel, tier: 'fast' as const };

      const { rerender } = render(
        <ModelCard model={flagshipModel} isSelected={false} onSelect={vi.fn()} />
      );
      expect(screen.getByText('Most Capable')).toBeInTheDocument();

      rerender(<ModelCard model={fastModel} isSelected={false} onSelect={vi.fn()} />);
      expect(screen.getByText('Fastest')).toBeInTheDocument();
    });
  });

  describe('ModelGrid Component', () => {
    it('should render all models', () => {
      render(<ModelGrid {...defaultProps} />);

      expect(screen.getByText('Claude 3.7 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Claude 3.5 Haiku')).toBeInTheDocument();
      expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
    });

    it('should show label for model selection', () => {
      render(<ModelGrid {...defaultProps} />);

      expect(screen.getByText('Select Claude Model')).toBeInTheDocument();
    });

    it('should mark the selected model', () => {
      render(
        <ModelGrid
          selectedModel="claude-3-5-sonnet-20241022"
          onModelChange={mockOnModelChange}
        />
      );

      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('should call onModelChange when a model card is clicked', () => {
      render(<ModelGrid {...defaultProps} />);

      const haikuCard = screen.getByText('Claude 3.5 Haiku').closest('button');
      fireEvent.click(haikuCard!);

      expect(mockOnModelChange).toHaveBeenCalledWith('claude-3-5-haiku-20241022');
    });

    it('should not call onModelChange when disabled', () => {
      render(<ModelGrid {...defaultProps} disabled={true} />);

      const haikuCard = screen.getByText('Claude 3.5 Haiku').closest('button');
      fireEvent.click(haikuCard!);

      expect(mockOnModelChange).not.toHaveBeenCalled();
    });

    it('should render cards in grid layout', () => {
      const { container } = render(<ModelGrid {...defaultProps} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Different Model Selections', () => {
    it('should correctly display Claude 3.7 Sonnet as selected', () => {
      render(
        <ModelSelector
          selectedModel="claude-3-7-sonnet-20250219"
          onModelChange={mockOnModelChange}
        />
      );

      expect(screen.getByText('Claude 3.7 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Most Capable')).toBeInTheDocument();
    });

    it('should correctly display Claude 3.5 Haiku as selected', () => {
      render(
        <ModelSelector
          selectedModel="claude-3-5-haiku-20241022"
          onModelChange={mockOnModelChange}
        />
      );

      expect(screen.getByText('Claude 3.5 Haiku')).toBeInTheDocument();
      expect(screen.getByText('Fastest')).toBeInTheDocument();
    });

    it('should correctly display Claude 3 Opus as selected', () => {
      render(
        <ModelSelector
          selectedModel="claude-3-opus-20240229"
          onModelChange={mockOnModelChange}
        />
      );

      expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
      expect(screen.getByText('Most Capable')).toBeInTheDocument();
    });
  });
});
