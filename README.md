# StockDesk Copilot

StockDesk is a mobile-first stock and sales desk for small neighborhood shops. The pre-existing app already handled authentication, businesses, products, stock counts, sales, restocks, reports, offline queues, and Supabase row-level security.

## Hackathon additions

OpenAI Build Week added **StockDesk Copilot** as an additive layer on top of the existing workflows. It does not replace the sale, restock, inventory, authentication, or reporting paths; it routes natural-language commands into the same Supabase views and RPCs used by the app.

Demo-ready prompts:

- `Sold 3 crates Fanta to Ngwa for 1500 francs`
- `Restock 20 bags rice`
- `What's my profit today?`
- `What's my best seller this week?`
- `Show today's revenue`

## OpenAI technologies used

- OpenAI Responses API for structured command parsing when deterministic parsing cannot confidently understand a request.
- JSON schema outputs to constrain the model to `sale`, `restock`, `report`, or `clarify` intents.
- Prompt-injection resistant design: the model never receives raw cost/profit data for worker flows, and server-side authorization gates every sensitive operation before data is queried.

## Architecture

```text
Copilot panel -> /api/agent-sale -> role check -> existing Supabase views/RPCs
                                      | sale    -> create_sale_order
                                      | restock -> create_restock (owner only)
                                      | report  -> owner report views (owner only)
```

The Copilot service is intentionally additive. It reuses:

- `products_worker_view` for worker-safe product lookups.
- `products_owner_view` for owner inventory and restock data.
- `create_sale_order` for atomic sale writes.
- `create_restock` for owner-only restock writes.
- `stock_transactions_owner_view` for owner-only reporting.

## Security model

- Missing or invalid sessions are rejected before any business data is queried.
- Business IDs are validated as UUIDs.
- Membership is checked for every request.
- Profit, cost price, stock valuation, and restocking are owner-only.
- Workers only use worker-safe product views without cost fields.
- Prompt-injection and jailbreak text is treated as untrusted user input; authorization is enforced in TypeScript and Supabase RLS/RPCs, not by model instructions.
- Long prompts are capped at 500 characters and malformed JSON returns a human-friendly error.
- Product matching happens against products from the authenticated business only, preventing cross-tenant access.

## Installation

```bash
npm install
npm run dev
```

Required environment variables:

```bash
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
OPENAI_API_KEY=... # optional for common demo phrases because deterministic parsing is tried first
```

## Build and checks

```bash
npm run lint
npm run build
```

## Demo flow

1. Sign in as a business owner.
2. Confirm products such as Fanta and rice exist.
3. Open the dashboard and use StockDesk Copilot examples.
4. Run the sale and restock prompts and watch stock counts refresh.
5. Ask the revenue, profit, and best-seller prompts to show owner-only reporting.
6. Sign in as a worker and verify profit/restock prompts return permission denied.

## Future work

- Add automated integration tests with seeded Supabase businesses and roles.
- Add streaming Copilot responses for long analysis.
- Add multilingual parsing for local shop languages.
- Add optional owner approval for high-value or unusual transactions.
