# octo-pancake

A personal finance management app built with Next.js 16, Drizzle ORM, and NeonDB. Manage your chart of accounts and financial accounts (bank, credit card, investments, etc.) with a clean, family-shared data model.

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Database** — PostgreSQL via [Neon](https://neon.tech) (serverless)
- **ORM** — Drizzle ORM
- **Auth** — Auth.js v5 (NextAuth) with Credentials provider + `@auth/drizzle-adapter`
- **UI** — shadcn/ui (New York style) + Tailwind CSS v4
- **Tables** — TanStack React Table v8

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A [Neon](https://neon.tech) database (or any PostgreSQL instance)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in DATABASE_URL and NEXTAUTH_SECRET in .env.local

# Run database migrations
pnpm db:migrate

# (Optional) Seed the Chart of Accounts
pnpm db:seed-coa

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and sign in.

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon / PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth JWT signing |
| `NEXTAUTH_URL` | App base URL (e.g. `http://localhost:3000`) |

## Database

```bash
pnpm db:generate   # Generate a new migration from schema changes
pnpm db:migrate    # Apply pending migrations
pnpm db:studio     # Open Drizzle Studio (browser DB explorer)
pnpm db:seed-coa   # Seed the chart of accounts with default data
```

## Project Structure

```
octo-pancake/
├── app/
│   ├── (app)/                    # Protected routes (requires auth)
│   │   ├── layout.tsx            # Sidebar layout
│   │   ├── dashboard/page.tsx
│   │   ├── accounts/page.tsx     # Financial accounts
│   │   └── coa/page.tsx          # Chart of accounts
│   ├── auth/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   └── api/
│       ├── auth/                 # NextAuth + register endpoints
│       ├── accounts/             # Financial accounts REST API
│       └── coa/                  # Chart of accounts REST API
│
├── components/
│   ├── account-table.tsx         # Financial accounts data table
│   ├── account-form.tsx          # Create / edit account form
│   ├── coa-table.tsx             # Chart of accounts data table
│   ├── coa-form.tsx              # Create / edit COA entry form
│   ├── app-sidebar.tsx           # Main navigation sidebar
│   └── ui/                       # shadcn/ui primitives
│
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle + Neon connection
│   │   ├── schema.ts             # All table definitions & TS types
│   │   └── seed-coa.ts           # COA seed script
│   └── repositories/
│       ├── user.repository.ts
│       ├── account.repository.ts
│       └── coa.repository.ts
│
├── drizzle/                       # Generated migration files
├── auth.ts                        # NextAuth configuration
└── drizzle.config.ts              # Drizzle config
```

## Architecture

Requests flow through three layers:

```
Page / Client component
    → fetch /api/<resource>
    → Route handler (app/api/)
    → Repository (lib/repositories/)
    → Drizzle ORM → NeonDB
```

Each domain has a repository class (`CoaRepository`, `AccountRepository`, `UserRepository`) that encapsulates all DB queries. Route handlers call repository methods and return JSON. Client components fetch from the API routes.

## Features

### Financial Accounts (`/accounts`)

Track bank accounts, credit cards, investments, and other financial accounts.

- **Types** — Savings, Checking, Credit Card, Investment, Benefits, Other
- **Fields** — Name, type, institution, owner, masked account number, opening balance, notes, active flag
- **Filters** — Filter by type, owner, and institution (multi-select pills, double-click to solo)
- **CRUD** — Create, edit, and delete accounts via a slide-in sheet form

### Chart of Accounts (`/coa`)

Hierarchical double-entry bookkeeping account tree, shared across all users.

- **Types** — Asset, Liability, Equity, Income, Expense
- **Hierarchy** — Parent–child relationships via `parentCode` (self-referencing FK)
- **Filters** — Filter by account type (multi-select pills, double-click to solo)
- **CRUD** — Create and edit accounts; code is immutable after creation

### Auth

- Email/password registration and sign-in
- JWT sessions managed by Auth.js v5
- Protected routes via `(app)` route group middleware
