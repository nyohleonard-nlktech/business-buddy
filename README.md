# StockDesk — Business Buddy

A mobile-first inventory and sales management application for small businesses, built with React, TypeScript, TanStack Start, and Supabase.

## Product areas
- Business onboarding and authentication.
- Product and inventory management.
- Sales recording and business performance views.
- Team/workers workflows.
- Mobile-first interface and Supabase-backed data services.

Feature availability depends on the configured Supabase project, schema, and access policies.

## Requirements
- Node.js compatible with the Vite/TanStack versions in package.json.
- Bun recommended (the repository includes bun.lock).
- A Supabase project for authenticated and data-backed workflows.

## Setup
```bash
git clone https://github.com/nyohleonard-nlktech/business-buddy.git
cd business-buddy
bun install
```

Configure the Supabase URL and public client key using the variable names referenced in src/integrations/supabase/client.ts. Apply migrations under supabase/migrations/ to a development project. Never commit credentials or service-role keys.

## Commands
```bash
bun run dev
bun run build
bun run preview
bun run lint
bun run format
```

## Structure
```text
src/
  components/       # Shared interface components
  hooks/            # Reusable React hooks
  integrations/     # Supabase clients and auth integration
  lib/              # Application services and helpers
  routes/           # TanStack file-based routes
supabase/
  migrations/       # Database schema history
public/
package.json
vite.config.ts
```

## Security
The repository contains a root .env file. Do not expose its values. Rotate any credentials that may have been committed, remove the tracked file from version control, and add it to .gitignore. Enforce business-level data isolation with server-side authorization and Row Level Security.

## License
No license file is present. All rights reserved unless an explicit license is added.
