# Expenser

A personal expense tracker. Log what you spend, organise it into categories, set a monthly budget, and see how the current month compares to the last. Amounts can be entered in different currencies and are converted using live exchange rates.

## Try it

**Live demo: <https://expenser-weeu.onrender.com>** – nothing to install. Every visitor gets a **private sandbox** pre-filled with demo expenses, so you can click around freely and nobody sees anyone else's data. Use **Settings → Reset demo data** to start over. Sandboxes are deleted after a week of inactivity.

The demo runs on a free hosting tier that sleeps when idle, so the first load can take about 30 seconds.

To run it yourself with one command and no database account (needs [Docker](https://www.docker.com/)):

```bash
docker compose up --build
```

Then open <http://localhost:5181>. The compose file also runs the app in demo mode (see [How the demo sandboxes work](#how-the-demo-sandboxes-work)). To host your own copy, see [Deploying](#deploying).

## Screenshots

**Dashboard** – this month's spending, budget left, top category and recent expenses.

![Dashboard](docs/screenshots/dashboard.png)

**Categories** – create, sort and delete the labels you group spending by, each default with its own icon.

![Categories](docs/screenshots/categories.png)

**Settings (dark theme)** – choose the language and display currency.

![Settings in dark theme](docs/screenshots/settings-dark.png)

## Features

- **Dashboard** – spending for the current month, change versus last month, number of transactions, top category, budget progress and the five most recent expenses.
- **Expenses** – add and delete expenses with a title, category, optional description, date, currency and amount.
- **Categories** – create and delete your own categories (ten defaults are added on first run). Each default has its own icon and is shown in the language you picked; your own categories are shown as typed. Names are unique ignoring case. Deleting a category never changes existing expenses.
- **Monthly budget** – set a budget from the dashboard; it is stored in the currency you chose.
- **Income** – record money coming in, in any supported currency. The dashboard then shows income, what is left, and your savings rate for the month.
- **Budgeting methods** – the **Budgets** page supports four ways of planning the month, and you pick the active one: *category limits* (a monthly limit per category, with over/under for each), a *percentage split* between needs, wants and savings (50/30/20 pre-fills the form, but the percentages are yours), *zero-based* (income minus category limits, savings goals, minimum debt payments and yearly-bill set-asides, until nothing is unassigned) and *pay yourself first* (a savings share comes off income, the rest is what you can spend). It also shows where this month is heading at the current pace, and how spending splits between fixed and variable costs. Categories you push past their limit are listed on the dashboard.
- **Fixed/variable and need/want** – classify each category on the **Categories** page. Nothing is classified for you, and anything left unclassified is reported as such.
- **Recurring** – bills, subscriptions and paychecks that repeat weekly, monthly or yearly. When a date arrives the matching expense or income is added automatically (a start date in the past adds what was missed). Yearly bills show the monthly amount to set aside, as a sinking fund.
- **Goals** – savings goals with an optional deadline (it works out what to save each month) and an emergency fund whose target is the number of months of *your own* average spending you choose. Deposit and withdraw at any time.
- **Debts** – track balance, rate and minimum payment, record payments, and compare the avalanche (highest rate first) and snowball (smallest balance first) payoff orders, with an optional extra monthly payment. Interest is not added to the balance automatically, so edit the balance to match a statement; a payment larger than the balance is rejected.
- **Reports** – income, spending, net and savings rate for the last 3, 6 or 12 months, month by month and by category, compared with the month before.
- **Multiple currencies** – SEK, EUR, GBP, JPY, USD and TWD. Totals on the dashboard are converted into your display currency using daily rates from [open.er-api.com](https://www.exchangerate-api.com) (no API key needed). Rates are cached for 6 hours, and the last good copy is used if the provider is unreachable.
- **Languages** – English, Svenska, 日本語 and 繁體中文（台灣）. The browser language is detected on first visit; change it any time in **Settings**.
- **Accessibility** – built to WCAG 2.2 level AAA wherever an app can: 7:1 text contrast, 44 px targets, a skip link, a visible focus ring, keyboard use everywhere, help text on the main form fields, confirmation before anything is deleted, a help and glossary page, and support for reduced motion, high contrast and 400 % zoom. See [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) for the criterion-by-criterion status and what has not been tested.
- **Light, dark or match-system theme**, remembered between visits. Choose it in **Settings**.
- **Default entry currency** – in **Settings**, choose the currency new expenses, income, recurring items, goals and debts start in (it follows the display currency until you pick one). You can still change it on each form.
- **Backup and restore** – in **Settings**, download everything as a JSON backup, or just the expenses or income as CSV for a spreadsheet. A backup can be restored later, which replaces the current data; a file is fully checked first, so a bad one changes nothing. **Delete all my data** empties the app and leaves the default categories.
- **Exchange-rate status** – **Settings** shows the date of the rates in use and when they were last checked, warns when the provider can't be reached and the last saved rates are being used, and has a **Refresh rates** button.

None of the new features ship with sample amounts: income, category limits, goals, debts and recurring items start empty and hold only what you enter.

## Tech stack

| Layer    | Tools                                                  |
| -------- | ------------------------------------------------------ |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4             |
| Backend  | Node.js, Express 5, Mongoose                           |
| Database | MongoDB (Atlas or a local instance)                    |

## Prerequisites

- **Node.js 24** or newer. The API server runs its TypeScript directly with `node` and loads `.env` with `--env-file`, so no separate compile step is needed.
- **A MongoDB database.** Either a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or a local server at `mongodb://localhost:27017`.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure the environment**

   Copy the example file and fill in your values:

   ```bash
   cp .env.example .env        # macOS / Linux / Git Bash
   copy .env.example .env      # Windows cmd
   ```

   | Variable        | Required | Description                                                                                          |
   | --------------- | -------- | ---------------------------------------------------------------------------------------------------- |
   | `MONGODB_URI`   | yes      | MongoDB connection string. For Atlas: *Connect → Drivers*. For local: `mongodb://localhost:27017`.   |
   | `MONGODB_DB`    | no       | Database name (default from the example: `expense-tracker`). Created automatically on first write.   |
   | `PORT`          | no       | Port for the API server. Defaults to `5181`; Vite proxies `/api` to it.                              |
   | `DEMO_MODE`     | no       | `true` turns on per-visitor demo sandboxes (see [below](#how-the-demo-sandboxes-work)). Leave it unset for development and personal use. |
   | `DNS_SERVERS`   | no       | Comma-separated DNS servers for Node, e.g. `8.8.8.8,1.1.1.1`. See [Troubleshooting](#troubleshooting). |

   `.env` is gitignored, so your credentials stay out of the repository.

3. **Start the app**

   ```bash
   npm run dev
   ```

   This runs the Vite dev server and the API server together. Open the URL Vite prints (usually <http://localhost:5180>).

   If you change `PORT`, also update the proxy target in [vite.config.ts](vite.config.ts).

## Deploying

The API server also serves the built frontend, so the whole app is one Node process on one URL.

```bash
npm run build   # builds the frontend into dist/
npm start       # serves the API and dist/ on $PORT (default 5181)
```

### Render (free tier)

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster and a database user used only for this demo. Under *Network Access* allow `0.0.0.0/0`, because Render's free tier has no fixed IP address.
2. In Render choose **New → Blueprint**, pick this repository, and paste the Atlas connection string as `MONGODB_URI` when asked. [render.yaml](render.yaml) configures everything else, including a separate `expenser-demo` database.
3. Once it's live, Render shows the app's URL on the service page. The live demo above was deployed this way.

The free tier sleeps after 15 minutes without traffic, so the first request afterwards takes about 30 seconds. Open the link yourself shortly before sharing it.

### Docker

[Dockerfile](Dockerfile) builds the frontend and runs the server; the image needs `MONGODB_URI` (and optionally `MONGODB_DB`, `PORT`) at runtime. [docker-compose.yml](docker-compose.yml) adds a MongoDB container for local use.

### How the demo sandboxes work

Sandboxes exist only when `DEMO_MODE=true`, which [render.yaml](render.yaml) and [docker-compose.yml](docker-compose.yml) set. Without it, which is the default for `npm run dev`, there is a single dataset (yours), no demo data, no limits, and the reset endpoint doesn't exist.

In demo mode there are no accounts. The browser creates a random id, keeps it in `localStorage` and sends it as the `X-Sandbox-Id` header on every API call. The server scopes all reads and writes to that id and fills a new sandbox with demo data on first use. Anyone who knows an id can see that sandbox, so this is suitable for a demo, **not** for real financial data. A visitor who clears their browser data gets a fresh sandbox, and the old one is removed after a week.

## Scripts

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `npm run dev`     | Starts the client and the API server together.                       |
| `npm run client`  | Starts only the Vite dev server.                                     |
| `npm run server`  | Starts only the API server (restarts on file changes).               |
| `npm run build`   | Type-checks the project and builds the frontend into `dist/`.        |
| `npm run preview` | Serves the production build locally (the API server must also run). |
| `npm start`       | Runs the API server, which also serves `dist/` if it has been built.  |
| `npm run lint`    | Runs ESLint.                                                         |
| `npm run a11y`    | Checks accessibility (colour contrast, axe-core WCAG rules, keyboard behaviour) against a running app; see [Accessibility checks](#accessibility-checks). |

## Accessibility checks

`npm run a11y` checks the colour tokens against AAA contrast, then opens every page in Chrome (light, dark and phone width) with [axe-core](https://github.com/dequelabs/axe-core), and finally tries the keyboard behaviour: skip link, focus after navigating, the confirm dialog, announcements and reflow. It needs Chrome installed (or `CHROME_PATH` pointing at a browser) and the app running with demo data:

```bash
npm run build
DEMO_MODE=true npm start     # on Windows PowerShell: $env:DEMO_MODE='true'; npm start
npm run a11y                 # in another terminal; set BASE=http://localhost:PORT if the port is not 5181
```

It exits with an error if anything fails, so it can gate a change. Run it after touching colours, forms or layout.

## Project structure

```
server/
  index.ts          Express app, error handling, static frontend, startup
  db.ts             MongoDB connection
  sandbox.ts        Per-visitor sandboxes: middleware, demo seeding, reset, cleanup
  demo.ts           Default categories and demo expenses
  rates.ts          Supported currencies, exchange-rate fetching/caching, conversion
  money.ts          Currency conversion and month helpers shared by the routes
  planning.ts       Month overview, goal and debt progress, category limits vs spending
  recurring.ts      Turns due recurring items into expenses / income
  debtPlan.ts       Avalanche and snowball payoff simulation
  models/           Mongoose models: Expense, Income, Category, CategoryBudget, Budget, Goal, Debt, Recurring
  routes/           API routes: expenses, income, categories, budget, summary, goals, debts, recurring, reports, rates, data, sandbox
src/
  App.tsx           Page switching
  pages/            Dashboard, Expenses, Income, Categories, Budgets (and budgets/ method panels), Recurring, Goals, Debts, Reports, Settings, Help
  components/       Layout (sidebar, header) and shared UI components
  config/           Navigation items and the icon for each default category
  i18n/             Language/currency preferences and message files (en, sv, ja, zh-TW)
  lib/api.ts        Typed fetch helper and useApi hook
  lib/sandbox.ts    Demo-mode sandbox id (kept in localStorage, sent with every request)
  lib/route.ts      The current page, kept in the URL hash (#/expenses)
  hooks/            Theme hook
scripts/a11y/       Accessibility checks (`npm run a11y`): contrast, axe-core audit, keyboard behaviour
docs/               Screenshots and the accessibility statement
```

## API

All routes are under `/api`. In demo mode only, every request except `/api/health` and `/api/rates` needs an `X-Sandbox-Id` header containing a UUID, and the data you read and write belongs to that id (see [How the demo sandboxes work](#how-the-demo-sandboxes-work)). Amounts are integers in minor units (cents), i.e. the displayed value × 100 — including for JPY.

| Method & path             | Description                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/health`         | `200` when connected to MongoDB, otherwise `503`. Includes `demo`, whether demo mode is on.         |
| `GET /api/expenses`       | Latest expenses, newest first. Optional `limit` (default 200, max 500).                             |
| `POST /api/expenses`      | Create an expense (max 500 per sandbox in demo mode): `title`, `category` (must exist), `date`, `amountCents`, `currency`, `description?`. |
| `DELETE /api/expenses/:id`| Delete an expense.                                                                                  |
| `GET /api/categories`     | All categories, each with the number of expenses that use it.                                       |
| `POST /api/categories`    | Create a category: `name`. Returns `409` if it already exists.                                      |
| `DELETE /api/categories/:id` | Delete a category.                                                                               |
| `GET /api/budget`         | The monthly budget (`monthlyCents`, `currency`).                                                    |
| `PUT /api/budget`         | Set the monthly budget: `monthlyCents`, `currency?`.                                                |
| `PUT /api/budget/method`  | Choose the budgeting method (`envelope`, `split`, `zeroBased`, `payFirst`) and its percentages: `split` needs `needsPercent`, `wantsPercent` and `savingsPercent` adding up to 100; `payFirst` needs `savingsPercent`. |
| `GET /api/budget/categories` | The per-category monthly limits.                                                                 |
| `PUT /api/budget/categories` | Set a category's monthly limit: `category` (must exist), `limitCents`, `currency?`.              |
| `DELETE /api/budget/categories/:id` | Remove a category limit.                                                                  |
| `GET /api/budget/overview` | This month's income, spending, savings, pace and per-category spending against limits, converted into `currency`. |
| `PATCH /api/categories/:id` | Classify a category: `costType` (`fixed`/`variable`) and/or `necessity` (`need`/`want`); `null` clears one. |
| `GET /api/income`, `POST /api/income`, `DELETE /api/income/:id` | List, add (`title`, `date`, `amountCents`, `currency`) and delete income. |
| `GET /api/goals`          | Goals with progress, converted into `currency`. An emergency fund's target is derived from average monthly spending. |
| `POST /api/goals`         | Create a goal: `name`, `kind` (`savings` needs `targetCents`, `deadline?`; `emergency` needs `targetMonths`), `currency`. |
| `POST /api/goals/:id/contributions` | Add money (`amountCents`) or take it out (negative); a goal cannot go below zero. `DELETE /api/goals/:id` removes a goal. |
| `GET /api/debts`          | Debts and both payoff plans, converted into `currency`. Optional `extra`: extra cents per month.   |
| `POST /api/debts`         | Create a debt: `name`, `balanceCents`, `aprPercent`, `minPaymentCents`, `currency`.                |
| `PATCH /api/debts/:id`    | Correct `balanceCents`, `aprPercent` or `minPaymentCents`. `POST /api/debts/:id/payments` records a payment; `DELETE /api/debts/:id` removes the debt. |
| `GET /api/recurring`      | Recurring items with their monthly equivalent, plus totals and the yearly-bill sinking fund.         |
| `POST /api/recurring`     | Create one: `kind` (`expense`/`income`), `title`, `amountCents`, `currency`, `frequency`, `startDate`, `category` (expenses). `PATCH /api/recurring/:id` with `active` pauses or resumes it; `DELETE` removes it. |
| `GET /api/reports`        | Income and spending per month and per category for the last `months` months (1–24, default 6).      |
| `GET /api/summary`        | Dashboard figures for the current month, converted into the `currency` query parameter (default `USD`). |
| `POST /api/sandbox/reset` | Demo mode only: replace the sandbox's data with a fresh copy of the demo data.                      |
| `GET /api/rates`          | Current exchange rates (base `USD`), when the provider dated them (`updatedAt`), when this server last fetched them (`fetchedAt`) and whether the provider was unreachable on the latest try so an older copy is used (`stale`). |
| `POST /api/rates/refresh` | Fetch the rates again now (at most once a minute; within that time the current ones are returned). Same response as `GET /api/rates`. |
| `GET /api/data/export`    | Everything in the current dataset as one JSON backup (`app: "expenser"`, `version`, budget, categories, expenses, income, category limits, goals, debts, recurring). |
| `GET /api/data/export/expenses.csv`, `GET /api/data/export/income.csv` | The expenses or the income as CSV (UTF-8 with a byte-order mark; amounts in major units, text that starts like a formula is prefixed with `'`). |
| `POST /api/data/import`   | Replace the current data with a backup in the format above. Every row is validated first; a bad file returns `400` and changes nothing. In demo mode the usual caps apply. |
| `DELETE /api/data`        | Delete everything in the current dataset and restore the default categories.                       |

Due recurring items are turned into expenses and income whenever the data is read, so no scheduler is needed.

In demo mode a missing or malformed `X-Sandbox-Id` returns `400`. Validation errors also return `400` with `{ "error": "..." }`. If exchange rates can't be fetched and none are cached, the API returns `503`.

## Troubleshooting

- **`MONGODB_URI is not set`** – you haven't created `.env`. Copy `.env.example` to `.env` and fill it in.
- **`querySrv ECONNREFUSED` when connecting to Atlas** – your network or VPN is blocking the SRV DNS lookup that `mongodb+srv://` URIs need. Uncomment `DNS_SERVERS=8.8.8.8,1.1.1.1` in `.env`.
- **Connection times out** – with Atlas, make sure your current IP address is allowed under *Network Access*, and that the username and password in the URI are correct (special characters in the password must be URL-encoded).
- **The page loads but shows errors fetching data** – check that the API server is running (`npm run dev` starts both) and that `http://localhost:5181/api/health` responds.
- **`npm install` fails with a certificate error** – on a network with a corporate proxy, point the local `.npmrc` at your organisation's CA file: `cafile=C:\path\to\corporate-ca.pem`. `.npmrc` is gitignored.
