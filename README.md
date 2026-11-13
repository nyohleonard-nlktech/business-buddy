# StockDesk — Business Buddy

**A mobile-first inventory and sales management application for small businesses.**

The application landing page describes workflows for registering a business, managing products, inviting workers, recording sales, and reviewing business performance. The codebase is a React/TypeScript application integrated with Supabase.

## Product areas

- Business onboarding and authentication.
- Product and inventory management.
- Sales recording and business performance views.
- Team/workers workflows.
- Mobile-first interface.
- Supabase-backed application services.

Feature availability depends on the configured Supabase project, database schema, and access policies.

## Stack

React 19, TypeScript, TanStack Start, TanStack Router, Vite, Supabase, Tailwind CSS, Radix UI, React Query, and React Hook Form.

## Requirements

- Node.js compatible with the package's Vite/TanStack versions
- Bun recommended (repository includes `bun.lock`)
- Supabase project for authenticated/data-backed workflows

## Setup

```bash
git clone https://github.com/nyohleonard-nlktech/business-buddy.git
cd business-buddy
bun install
```

Create a local environment file and configure the Supabase URL and public client key using the variable names referenced in `src/integrations/supabase/client.ts`. Do not commit `.env` or service-role credentials.

Apply the SQL migrations under `supabase/migrations/` to your development Supabase project.

## Development commands

```bash
bun run dev
bun run build
bun run preview
bun run lint
bun run format
```

## Structure

```text
.
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── integrations/
│   │   └── supabase/
│   ├── lib/
│   ├── routes/
│   ├── router.tsx
│   ├── server.ts
│   └── styles.css
├── supabase/
│   └── migrations/
├── package.json
├── vite.config.ts
└── README.md
```

## Database and access control

Review the migrations and Row Level Security policies before deploying. Every business record must be scoped to the correct business and authorized user. Do not rely on client-side route visibility to protect inventory, sales, or staff data.

## Deployment

Configure the selected hosting provider with the required public Supabase environment variables, build command `bun run build`, and the appropriate output/runtime settings for the TanStack Start adapter. Test sign-in, data isolation, and role permissions in the deployed environment.

## Security

The repository contains a root `.env` file. Do not publish its values. If it contains credentials that were ever committed, rotate them, then remove the file from version control and add it to `.gitignore`.

## License

No license file is currently present. All rights reserved unless an explicit license is added.
