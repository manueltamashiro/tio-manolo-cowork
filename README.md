# Tio Manolo Cowork

An AI-powered cowork workspace/chat application built with Next.js and Anthropic's Claude AI.

## Features

- Real-time streaming chat with Claude AI
- Secure API key management with AES encryption
- Support for multiple Claude models (3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku, Opus)
- Settings page for API key management
- Dark theme UI with Tailwind CSS

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **AI SDK:** @anthropic-ai/sdk
- **Database:** SQLite (better-sqlite3) for chat history
- **Testing:** Playwright

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tio-manolo-cowork
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get your API key from: https://console.anthropic.com/

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Create a production build:

```bash
npm run build
npm run start
```

### Testing

Run E2E tests with Playwright:

```bash
npm test
```

Run tests with UI:

```bash
npm run test:ui
```

### Linting

```bash
npm run lint
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page (chat interface)
├── components/            # React components
├── lib/                   # Utilities and integrations
│   ├── api/              # API integrations (Claude)
│   ├── storage/          # Storage utilities
│   └── db/               # Database schema
├── tests/                # E2E tests
└── types/                # TypeScript type definitions
```

## API Key Security

API keys are encrypted using AES encryption before being stored. The application uses:
- Cookie-based storage for server-side API requests
- LocalStorage backup with encryption for client-side access

## License

MIT
