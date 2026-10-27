# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.5.0]: https://github.com/ernestoneyra/expense-tracker/releases/tag/v0.5.0
