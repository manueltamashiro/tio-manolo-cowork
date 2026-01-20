# Test Framework Guide

This directory contains the Playwright testing framework for Tio Manolo Cowork, supporting both web E2E tests and Electron app tests.

## Directory Structure

```
tests/
├── e2e/                    # Web E2E tests (Chromium)
│   └── *.spec.ts
├── electron/               # Electron app tests
│   └── *.spec.ts
├── fixtures/               # Test fixtures and extensions
│   ├── electron.ts         # Electron-specific fixtures
│   └── index.ts
├── helpers/                # Test helper functions
│   ├── electron-helpers.ts # Electron helper class
│   └── index.ts
├── utils/                  # Test utilities and constants
│   ├── test-constants.ts   # Test constants
│   ├── test-utils.ts       # Utility functions
│   └── index.ts
├── global-setup.ts         # Global test setup
└── global-teardown.ts      # Global test cleanup
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run only web tests
```bash
npx playwright test --project chromium
```

### Run only Electron tests
```bash
npx playwright test --project electron
```

### Run with Playwright UI
```bash
npm run test:ui
```

### Run specific test file
```bash
npx playwright test tests/e2e/example.spec.ts
```

### Run tests matching a pattern
```bash
npx playwright test --grep "should load"
```

## Electron Testing

### Electron Test Setup

Electron tests use the `_electron` launcher from Playwright. The framework provides:

1. **Electron Fixtures** (`tests/fixtures/electron.ts`)
   - `electron`: The ElectronApplication instance
   - `window`: The first window (Page) of the Electron app

2. **Electron Helpers** (`tests/helpers/electron-helpers.ts`)
   - `ElectronHelpers`: A utility class for common Electron testing operations
   - `createElectronHelpers()`: Factory function to create helper instances
   - `TestDataBuilder`: A builder class for creating test data

### Example Electron Test

```typescript
import { test as electronTest, expect } from "@playwright/test";
import { _electron as electron } from "@playwright/test";
import { createElectronHelpers } from "@/tests/helpers";

electronTest("should launch app", async ({}) => {
  const electronApp = await electron.launch({
    executablePath: process.env.ELECTRON_PATH,
  });

  const window = await electronApp.firstWindow();
  const helpers = createElectronHelpers(electronApp, window);

  // Get app info
  const appInfo = await helpers.getAppInfo();
  console.log("App:", appInfo.appName);

  await electronApp.close();
});
```

## Web Testing

### Web Test Setup

Web tests use standard Playwright browser testing with the Next.js dev server automatically started.

### Example Web Test

```typescript
import { test, expect } from "@playwright/test";

test("should load home page", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toContainText("Tio Manolo Cowork");
});
```

## Test Utilities

### Using Test Constants

```typescript
import {
  TEST_TIMEOUTS,
  TEST_SELECTORS,
  TEST_DATA,
  API_ENDPOINTS,
} from "@/tests/utils";

test("example", async ({ page }) => {
  await page.goto(API_ENDPOINTS.CHAT);
  await page.waitForTimeout(TEST_TIMEOUTS.DEFAULT);
  await expect(page.locator(TEST_SELECTORS.API_KEY_INPUT)).toBeVisible();
});
```

### Using Test Utils

```typescript
import {
  clearLocalStorage,
  setTestApiKey,
  waitForElementVisible,
  mockApiRoute,
} from "@/tests/utils";

test("example with utils", async ({ page, context }) => {
  await clearLocalStorage(page);
  await setTestApiKey(page);
  await waitForElementVisible(page, "#chat-interface");
});
```

## Environment Variables

- `ELECTRON_PATH`: Path to Electron executable (optional, uses installed package by default)
- `CI`: Set to `true` in CI environments (affects retries and server reuse)

## Test Artifacts

Test results and artifacts are stored in `test-results/`:

- `html-report/` - HTML test report
- `screenshots/` - Test screenshots
- `artifacts/` - Test artifacts (traces, videos, etc.)
- `results.json` - JSON test results

## Debugging

### Debug with Playwright Inspector
```bash
npx playwright test --debug
```

### Debug with headed mode
```bash
npx playwright test --headed
```

### View trace after test failure
```bash
npx playwright show-trace test-results/artifacts/trace.zip
```

## Writing New Tests

1. **Web tests**: Add to `tests/e2e/` with `.spec.ts` extension
2. **Electron tests**: Add to `tests/electron/` with `.spec.ts` extension
3. Use the provided helpers and utilities for consistency
4. Follow the existing test patterns in the codebase
