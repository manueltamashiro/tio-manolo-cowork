import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ToastProvider } from '@/lib/context/ToastContext';

// Wrapper with providers
interface AllProvidersProps {
  children: React.ReactNode;
}

function AllProviders({ children }: AllProvidersProps) {
  return <ToastProvider>{children}</ToastProvider>;
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapper?: React.ComponentType<any>;
}

function customRender(
  ui: ReactElement,
  { wrapper = AllProviders, ...options }: CustomRenderOptions = {}
) {
  return render(ui, { wrapper, ...options });
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { customRender as render };

// Helper to create mock toast
export function createMockToast(overrides = {}) {
  return {
    id: 'test-toast-1',
    type: 'info' as const,
    message: 'Test toast message',
    duration: 5000,
    createdAt: Date.now(),
    ...overrides,
  };
}

// Helper to create mock session
export function createMockSession(overrides = {}) {
  return {
    id: 'session-1',
    title: 'Test Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    ...overrides,
  };
}

// Helper to wait for async operations
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to create a mock file
export function createMockFile(overrides = {}) {
  return {
    name: 'test-file.ts',
    path: '/path/to/test-file.ts',
    type: 'file',
    ...overrides,
  };
}
