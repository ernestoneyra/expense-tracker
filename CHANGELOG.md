# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Demo mode (`DEMO_MODE=true`, off by default): each browser gets a private copy of the data, so a hosted demo can be shared without visitors seeing each other's expenses. Sandboxes are deleted after a week of inactivity and capped at 500 expenses and 50 categories. Development and personal use are unchanged.
- In demo mode every new sandbox is filled with demo data (26 expenses in several currencies, ten categories and a budget), and Settings gets a "Reset demo data" button.
- `/api/health` reports whether demo mode is on.
- The API server now serves the built frontend, so the whole app runs from one URL with `npm run build && npm start`.
- `Dockerfile` and `docker-compose.yml` for a one-command local run, and a `render.yaml` blueprint for deploying to Render.

### Changed

- In demo mode every `/api` request except `/api/health` and `/api/rates` must send an `X-Sandbox-Id` header (the frontend does this automatically).
- Category names are unique per sandbox (in practice still unique overall outside demo mode). Existing data keeps working outside demo mode.

## [0.5.0] - 2026-10-27

First tracked release of Expenser, a personal expense tracker.

### Added

- Responsive app shell with a sidebar, header and a light/dark theme that is remembered between visits.
- Dashboard showing spending for the current month, the change versus last month, transaction count, top category, budget progress and the five most recent expenses.
- Expenses page to add and delete expenses with a title, category, optional description, date, currency and amount.
- Categories page to create and delete categories, with ten defaults seeded on first run. Names are unique ignoring case, and deleting a category leaves existing expenses unchanged.
- Confirmation toast before a category is deleted.
- Monthly budget that can be set from the dashboard and is stored in the chosen currency.
- Multi-currency support for SEK, EUR, GBP, JPY, USD and TWD, with dashboard totals converted into the display currency.
- Daily exchange rates from open.er-api.com (no API key), cached for 6 hours, falling back to the last good copy if the provider is unreachable.
- Localisation in English, Svenska, 日本語 and 繁體中文（台灣）, with the browser language detected on first visit.
- Settings page to choose the language and display currency.
- Express 5 API backed by MongoDB through Mongoose, with endpoints for expenses, categories, budget, summary and exchange rates.
- `.env.example` and a README with screenshots, a feature list and setup instructions.
- Placeholder pages for Budgets, Reports and Recurring expenses.

[Unreleased]: https://github.com/ernestoneyra/expense-tracker/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/ernestoneyra/expense-tracker/releases/tag/v0.5.0
