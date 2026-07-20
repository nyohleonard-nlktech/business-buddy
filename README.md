# StockDesk

StockDesk is a multi-tenant inventory and sales app for small shopkeepers. It was originally built in Lovable and deployed on Cloudflare Workers.

## What existed before July 13, 2026

Before the Codex submission period, StockDesk already had:

- Business registration and multi-tenant memberships.
- Product tracking with custom units and low-stock thresholds.
- Worker invites by code.
- Role-based visibility that hides cost price and profit from workers.
- Sale, restock, sales-log, restock-log, and owner reports screens.
- Supabase-backed row-level security, owner/worker views, and RPCs for sales/restocks.
- A Lovable-generated frontend connected to the Lovable project history.

## What Codex built during the submission period

Codex added StockDesk Copilot as a separate, additive agent service rather than replacing the existing UI. The dashboard now includes a natural-language command box that routes shopkeeper commands to the same backend RPCs and report views used by the manual screens.

Demo commands:

- `sold 3 crates Fanta to Ngwa 1500 francs` logs a sale, resolves the product, records the buyer in the note, and confirms in plain language.
- `restock 20 bags rice` resolves the product, calls the existing restock RPC, and confirms the received quantity. This is owner-only.
- `how much profit today` and `what's my best seller this week` read owner report data and answer in plain language. Workers are blocked at the agent layer before any owner report data is queried.

The core parsing/routing logic lives in `src/lib/stockdesk-agent.ts`, with the HTTP entrypoint in `src/routes/api.agent-sale.ts`.

## /feedback session

Codex session ID for the core parsing/routing implementation: `codex-stockdesk-copilot-2026-07-20`.
