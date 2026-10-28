# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Accounts, and an OAuth 2.0 server of its own.** Everyone now signs in, and has their own private expenses, budgets, goals, debts and recurring items; nothing is shared between accounts.
  - The app is its own authorization server and resource server. The web app signs in with the authorization code flow and S256 PKCE (`GET /api/oauth/authorize`, `POST /api/oauth/token`), gets a short-lived signed access token (a JWT, Ed25519, 15 minutes) and a rotating refresh token, and the API only accepts `Authorization: Bearer`. The refresh token is delivered in an `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/oauth`, so scripts on the page never see it. Also `POST /api/oauth/revoke` (RFC 7009), `GET /api/oauth/jwks` and `GET /.well-known/oauth-authorization-server` (RFC 8414).
  - Register with a username and password, or sign in with **Google** or **GitHub** (each switched on by setting its client id and secret, see the README). Either way the app's own tokens are what the API sees.
  - Two shared demo accounts, **`guest1`** and **`guest2`**, both with the password `password`, are created on first start with sample data. They can't be deleted or have their password changed; `SEED_GUESTS=false` turns them off.
  - **Settings → Account**: change your password, sign out of your other devices, delete your account and everything in it.
  - An account menu in the header with who is signed in, a link to the account settings, and sign out.
  - The sign-in and registration pages are in all four languages, work with a keyboard and screen reader (errors are announced and take focus), and pass the accessibility checks. `npm run a11y` now signs in as `guest1` and also checks them.
- `npm run claim-data -- <username>` gives data saved before accounts existed to an empty account.
- `npm test`: unit tests for password hashing, usernames, cookies, rate limiting, PKCE and token signing and checking.
- Environment variables `APP_URL`, `TRUST_PROXY`, `SEED_GUESTS`, `OAUTH_SIGNING_KEY`, `OAUTH_ACCESS_TTL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

### Security

- Passwords are hashed with scrypt. Refresh tokens and authorization codes are random and only their hashes are stored. A code works once for a minute; replaying one revokes what it produced.
- The refresh token is never exposed to JavaScript (not in a response body, storage or `document.cookie`), so a cross-site-scripting bug can't steal the long-lived credential; the page also runs under a strict Content-Security-Policy. Only a harmless "signed in" flag is kept in `localStorage`.
- Refresh tokens rotate, and a retired one being used again revokes the whole sign-in. Signing out, signing out of other devices and changing the password revoke refresh tokens on the server. Access tokens can't be recalled, so they are kept to 15 minutes, and the account is looked up on each request so a deleted account stops at once.
- Only the authorization code flow with S256 PKCE is offered: no implicit flow, no password grant. Redirect addresses must match exactly, and a bad client or address is shown an error rather than redirected to.
- Failed sign-ins, registrations, token requests and password confirmations are rate limited. A wrong password and an unknown username give the same answer in the same time.
- Browser requests that change data from another site are refused. The server sends a Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, a referrer policy and HSTS over HTTPS, and account, token and data responses are `no-store`.
- **NoSQL operator injection** (the app is MongoDB, so there is no SQL): an audit of every query found none exploitable, because each handler validates its input, but nothing enforced that. Now a request with an operator or path as a field name (`$ne`, `a.b`, `a[$gt]`, `__proto__`) is refused with a `400` before any route runs, and Mongoose's `sanitizeFilter` makes an operator that reaches a query anyway a literal value (filters the app writes itself are marked `trusted()`). `npm run security` sends about 840 injection payloads at every endpoint, including login, the token endpoints and the backup import.
- `POST /api/expenses` refuses a `description` that isn't text instead of silently dropping it.
- Google and GitHub accounts are matched by the provider's account id, never by email, so registering with someone's address can't take over their account.

### Changed

- **Breaking:** the API now needs an access token. Outside demo mode there is no longer a single shared dataset: data saved before accounts existed has no owner until it is claimed with `npm run claim-data`.
- In demo mode, visitors can still use a private anonymous sandbox through **Try the demo without an account**; signing in is the alternative.
- Signing out returns to the sign-in page, and the next person to sign in starts on the dashboard.
- `POST /api/rates/refresh` needs an access token; `GET /api/rates` stays open so the sign-in page can load.
- The theme script moved from `index.html` to `public/theme-init.js`, so the Content-Security-Policy can forbid inline scripts.
- The Vite dev proxy no longer rewrites the `Host` header (`changeOrigin: false`), because the OAuth redirect address and token issuer are worked out from it, and also proxies `/.well-known`.
- `render.yaml` sets `TRUST_PROXY=1` and asks for `APP_URL`.

## [0.8.0] - 2026-10-28

### Added

- **Accessibility to WCAG 2.2 level AAA** wherever an app can reach it; see [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for each criterion and what has not been tested.
  - Text contrast of at least 7:1 in both themes, 3:1 for field borders, the focus ring and progress bars, and a thick focus ring that is never hidden behind the header or a dialog.
  - Every button, link and field is at least 44 × 44 px. The chosen option in a group (range, sort, budgeting method, payoff plan) and the current page are shown with a border and bold text as well as a tint.
  - A skip link, a page title that says where you are, the page in the URL (`#/expenses`) so the Back button works, and focus that moves to the page after you navigate. The menu is now made of links.
  - A **Help** page with a glossary of the financial words (budgeting methods, sinking fund, APR, avalanche and snowball, CSV and JSON…) in all four languages, and a link to it from the pages that use them.
  - Short help text under each form field, read out with the field.
  - A polite announcement ("Saved.", "Deleted.") after a change, loading and error messages that are announced, and a heading on every page even while it loads.
  - Confirmation before deleting an expense, an income entry, a recurring item or a category limit, as for everything else that cannot be undone. The confirmation is now a real modal dialog: focus stays inside it, Escape cancels, and focus returns to the button you used.
  - Smooth motion is turned off when the system asks for reduced motion, and progress bars stay visible in Windows high-contrast mode.
  - `npm run a11y`: checks colour tokens, runs axe-core's A, AA and AAA rules on every page in light, dark and phone width, and tests the keyboard behaviour. New dev dependencies: `axe-core` and `playwright-core`.

### Changed

- The colour palette is darker or lighter as needed to reach AAA contrast. Secondary text is now close to the main text colour; hierarchy comes from size and weight.
- Small text (13 px) is now 14 px, line spacing is 1.5 throughout, and paragraphs are limited to 80 characters (40 for Japanese and Chinese).
- Long titles and values wrap instead of being cut off with an ellipsis.
- `Field` and `AmountField` link labels to inputs explicitly, and take a `hint`.

### Fixed

- The "Add expense" button in the header had no accessible name on narrow screens, where only its icon is shown.
- Some progress bars had no name for screen readers.

## [0.7.0] - 2026-10-28

### Added

- **Income** page: record money coming in. The dashboard gains income, net and savings-rate figures once there is income this month, and lists categories that have gone over their limit.
- **Budgets** page with four budgeting methods: category limits, a percentage split between needs, wants and savings (the classic 50/30/20 pre-fills the form), zero-based, and pay yourself first. It also shows this month's pace, and fixed versus variable spending. The existing monthly budget on the dashboard is unchanged.
- Categories can be marked fixed or variable and as a need or a want. Nothing is classified by default.
- **Recurring** page: bills, subscriptions and paychecks repeating weekly, monthly or yearly, which become real expense or income entries when due. Yearly bills show the monthly sinking-fund amount.
- **Goals** page: savings goals with an optional deadline and an emergency fund sized in months of your own average spending, with deposits and withdrawals.
- **Debts** page: balances, rates and payments, with avalanche and snowball payoff plans and an optional extra monthly payment.
- **Reports** page: income, spending, net and savings rate for the last 3, 6 or 12 months, by month and by category.
- New features start empty and contain no sample amounts or data; in demo mode they are cleared by "Reset demo data" too (capped at 100 records per kind per sandbox).
- Settings: a **default currency for new entries**. New expenses, income, recurring items, goals and debts start in it instead of the display currency; by default it still follows the display currency.
- Settings: a **theme** choice of Light, Dark or Match system.
- Settings: **backup and restore**. Download everything as a JSON backup, or the expenses or income as CSV; restore a backup (it replaces the current data and is fully validated before anything is deleted); and **Delete all my data**, which leaves the default categories. New endpoints `GET /api/data/export`, `GET /api/data/export/expenses.csv`, `GET /api/data/export/income.csv`, `POST /api/data/import` and `DELETE /api/data`.
- Settings: **exchange-rate status**. Shows the date of the rates and when they were last checked, warns when the provider can't be reached and the last saved rates are in use, and has a **Refresh rates** button (`POST /api/rates/refresh`, at most once a minute). `GET /api/rates` now also returns `fetchedAt` and `stale`.

### Changed

- The Budgets, Reports and Recurring pages are no longer placeholders, and the placeholder page is gone.
- The demo reset text now says that everything you entered is removed.
- The theme button is gone from the header; the theme is now chosen in Settings.
- The server accepts request bodies up to 10 MB on `/api/data` (for backups); every other route keeps the 100 kB default. A body that is too large or not valid JSON now gets a `413` or `400` with a message instead of a generic `500`.

## [0.6.1] - 2026-10-27

### Added

- Icons for the ten default categories, shown on the Categories page and next to the category in the expense lists on the Dashboard and Expenses pages. Categories you create yourself get a generic tag icon.

### Changed

- The ten default categories are now shown in the selected language (English, Svenska, 日本語 and 繁體中文（台灣）) on the Dashboard, Expenses and Categories pages and in the category picker. Categories you create yourself are shown as typed, and the stored names stay in English. Sorting categories by name follows the selected language.

### Fixed

- The amount and currency fields on the Expenses form now share the row in a fixed 65/35 split, so the currency picker no longer squeezes the amount input.

## [0.6.0] - 2026-10-27

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

[0.8.0]: https://github.com/ernestoneyra/expense-tracker/compare/0.7.0...0.8.0
[0.7.0]: https://github.com/ernestoneyra/expense-tracker/compare/0.6.1...0.7.0
[0.6.1]: https://github.com/ernestoneyra/expense-tracker/compare/0.6.0...0.6.1
[0.6.0]: https://github.com/ernestoneyra/expense-tracker/compare/0.5.0...0.6.0
[0.5.0]: https://github.com/ernestoneyra/expense-tracker/releases/tag/0.5.0
