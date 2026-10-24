# DataLens

**Upload a CSV, understand it, and model it.** DataLens is a full-stack MERN application that profiles a dataset automatically (types, missing values, summary statistics, distributions, correlations) and trains a linear regression model on it, with the learning algorithm written from scratch rather than imported from a library.


## Features

- **Automatic profiling.** Upload a CSV and get row and column counts, inferred column types (number, string, boolean, date), missing values, duplicates, min/max/mean/median/quartiles/standard deviation, histograms, top categories and a Pearson correlation heatmap.
- **Linear regression from scratch.** Batch gradient descent on standardised features, with a seeded train/test split, convergence detection, and R², RMSE and MAE on both sets. Learned weights are converted back to the original units, so predictions work on raw inputs.
- **Explainable results.** Loss curve, predicted-vs-actual plot, per-feature weights with relative influence, and a warning when train R² is far above test R² (overfitting).
- **Live predictions.** Enter feature values and get a prediction from any saved model.
- **Reports.** Save a model as a report with notes. A report stores a snapshot, so it stays readable even if the dataset is deleted later. Reports print cleanly.
- **Accounts and roles.** Register and sign in; every dataset, model and report is private to its owner. Admins get a user-management page with platform statistics.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Tailwind CSS 4, Recharts, Axios |
| Backend | Node.js, Express 4, Mongoose 8, Zod, Multer, csv-parse |
| Database | MongoDB |
| Auth | JWT access tokens, rotating refresh tokens in httpOnly cookies, bcrypt |
| Ops | Docker, Docker Compose, nginx, GitHub Actions |

## Architecture

```
Browser (React SPA)
   │  Bearer access token (kept in memory)      httpOnly refresh cookie (sent only to /api/auth)
   ▼
nginx  ── serves the built SPA, proxies /api/* ──►  Express API
                                                     ├─ routes/    auth · datasets · models · reports · admin
                                                     ├─ services/  csv · profiler · regression  (pure functions, unit-tested)
                                                     ├─ middleware/ auth · validation (Zod) · rate limiting · errors
                                                     └─ models/    User · RefreshToken · Dataset · MlModel · Report
                                                                      │
                                                                   MongoDB
```

## Getting started

### Option 1: Docker (recommended)

```bash
cp .env.example .env
# Fill in JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (the file shows a one-line generator command)
docker compose up --build
```

Open <http://localhost:8080>. To make yourself an admin, put your email in `ADMIN_EMAILS` in `.env` before you register.

### Option 2: Local development

You need Node.js 22+ and a running MongoDB (local, Docker, or an Atlas connection string).

```bash
# Terminal 1: API
cd server
cp .env.example .env        # adjust MONGODB_URI if needed
npm install
npm run dev                 # http://localhost:5000

# Terminal 2: web app
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to the API)
```

A sample file is included at [`sample-data/housing.csv`](sample-data/housing.csv). Upload it, train `price` from `sqft`, `bedrooms` and `age`, and the model recovers the relationship the data was generated from.

## Environment variables

Never commit a real `.env` file. Only the `.env.example` files are tracked, and `.gitignore` excludes everything else.

**Generate the two secrets** (run it twice; they must be different from each other):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Local development: `server/.env`

Copy `server/.env.example` to `server/.env` and set:

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | |
| `PORT` | `5000` | |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/datalens` | Or an Atlas string, see below |
| `CLIENT_ORIGIN` | `http://localhost:5173` | The only origin allowed by CORS |
| `JWT_ACCESS_SECRET` | *generated secret #1* | Optional in development, required in production |
| `JWT_REFRESH_SECRET` | *generated secret #2* | Must differ from the access secret |
| `JWT_ACCESS_TTL` | `15m` | |
| `JWT_REFRESH_TTL_DAYS` | `7` | |
| `ADMIN_EMAILS` | the email you will register with | That account becomes an admin when it registers |
| `COOKIE_SAMESITE` | `lax` | |
| `TRUST_PROXY` | `false` | |

`client/.env` is **not needed** locally. The Vite dev server proxies `/api` to port 5000, so leave `VITE_API_URL` empty.

### Docker Compose: root `.env`

Copy the root `.env.example` to `.env` and set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAILS`, and leave `COOKIE_SECURE=false` for `http://localhost:8080`. Compose already sets the database address (`mongodb://mongo:27017/datalens`), `CLIENT_ORIGIN` and `TRUST_PROXY` for you.

### Production (for example Render for the API and Vercel for the web app)

On the **API**:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | two new generated secrets (the server refuses to start without them) |
| `CLIENT_ORIGIN` | your web app URL, for example `https://datalens.vercel.app` (no trailing slash) |
| `TRUST_PROXY` | `true` |
| `ADMIN_EMAILS` | your email |
| `COOKIE_SECURE` | `true` (this is already the default in production) |
| `COOKIE_SAMESITE` | `lax` when you use the Vercel rewrite below, `none` only for a cross-site setup |

On the **web app**: if you use the `/api` rewrite in `client/vercel.json` (recommended, it keeps the cookie first-party), set no variables. Otherwise set `VITE_API_URL` to your API address and use `COOKIE_SAMESITE=none` on the API.

### Getting a MongoDB Atlas connection string

1. Create a free cluster at <https://www.mongodb.com/atlas>.
2. Under **Database Access**, add a user with a password.
3. Under **Network Access**, allow your IP (or `0.0.0.0/0` for a hosted API).
4. Click **Connect, Drivers** and copy the string. Put the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/datalens?retryWrites=true&w=majority`
5. If the password has special characters (`@`, `:`, `/`, `#`), URL-encode them.

Changing the JWT secrets later signs every user out, which is expected.

## Tests

```bash
cd server
npm test
```

The suite covers the maths (recovering known weights, matching the closed-form slope, reproducibility, constant features, divergence), the CSV parser and profiler, and the API end to end: registration and validation, login, refresh rotation and reuse detection, logout, ownership isolation between users, upload limits, training, prediction, reports, and admin permissions.

API tests need a running MongoDB. They use `TEST_MONGODB_URI` (default `mongodb://127.0.0.1:27017/datalens_test`), refuse to run against any database whose name does not end in `_test`, and never read your `.env`. CI runs them against a MongoDB 7 service container on every push.

## API overview

All routes are under `/api`. Everything except `auth/*` and `health` needs an `Authorization: Bearer <accessToken>` header.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Create an account or sign in. Returns the user and an access token, and sets the refresh cookie |
| POST | `/auth/refresh` | Exchange the refresh cookie for a new access token (rotates the refresh token) |
| POST | `/auth/logout` | Revoke the current session |
| GET | `/auth/me` | Current user |
| POST | `/datasets` | Upload a CSV (multipart, field `file`) and profile it |
| GET | `/datasets`, `/datasets/:id` | List datasets or fetch one with its full profile |
| PATCH, DELETE | `/datasets/:id` | Rename, or delete with its models |
| POST | `/models` | Train linear regression: `{ datasetId, target, features[], learningRate?, epochs?, testSize? }` |
| GET | `/models`, `/models/:id` | List models (optionally `?dataset=`) or fetch one |
| POST | `/models/:id/predict` | `{ inputs: { feature: number } }` returns a prediction |
| DELETE | `/models/:id` | Delete a model |
| POST, GET, DELETE | `/reports`, `/reports/:id` | Save, list, read and delete reports |
| GET, PATCH, DELETE | `/admin/stats`, `/admin/users`, `/admin/users/:id[/role]` | Admin only |

## Security notes

- **Passwords** are hashed with bcrypt (12 rounds) and must be 8 to 72 characters with a letter and a number. Login returns the same error for an unknown email and a wrong password, and compares against a dummy hash so response time does not reveal which emails exist.
- **Tokens.** Access tokens last 15 minutes and live only in memory, never in `localStorage`. The refresh token is an httpOnly, `SameSite` cookie scoped to `/api/auth`, so page scripts cannot read it.
- **Refresh rotation.** Each refresh token is single-use and consumed with an atomic delete. Presenting a token that was already used is treated as theft and revokes all of that user's sessions. Expired sessions are removed by a MongoDB TTL index.
- **Authorisation.** Every query is scoped to the signed-in user, so another user's resource returns 404 rather than revealing that it exists. Role checks protect admin routes, and the user is re-read from the database on each request, so deleted accounts and role changes take effect immediately.
- **Input handling.** Request bodies are validated with Zod (which also blocks NoSQL operator injection such as `{ "$gt": "" }`), ids are checked before reaching a query, uploads are limited to `.csv` files of 5 MB, 20,000 rows and 100 columns, and bodies are capped at 100 KB.
- **Hardening.** Helmet headers, CORS restricted to the configured origin, and rate limiting (stricter on login and register).

## Design decisions and limits

- **Why gradient descent, not a library?** The point of the project is showing the algorithm, so training is implemented directly. Features and target are standardised so one learning rate works across very different scales, and the weights are converted back to original units afterwards.
- **Columnar storage.** Raw values are stored column-wise, keyed by column index, which suits training and avoids arrays nested inside arrays (some MongoDB-compatible databases reject those).
- **Document size.** Rows live inside the dataset document, so uploads are capped (5 MB, 20,000 rows) to stay well under MongoDB's 16 MB document limit. Larger files would need GridFS or a separate rows collection.
- **Scope.** Only numeric columns can be used for training, rows with a missing value in a used column are dropped (and the count is shown), and the model is a single linear regression. Natural next steps are categorical encoding, regularisation (ridge/lasso), and a second algorithm for comparison.

## Deployment

The stack runs anywhere Docker does using `docker-compose.yml`. For a split deployment (for example the web app on Vercel, the API on Render, and MongoDB Atlas):

1. Create an Atlas cluster and set `MONGODB_URI` on the API.
2. Deploy `server/` with `NODE_ENV=production`, both JWT secrets, `CLIENT_ORIGIN` set to the web app's URL, and `TRUST_PROXY=true`.
3. Deploy `client/` and edit `client/vercel.json` to point the `/api` rewrite at your API host. This keeps the refresh cookie first-party, which avoids third-party cookie blocking in Safari and other browsers.
4. If you would rather call the API cross-site, set `VITE_API_URL`, `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`.

## Project structure

```
datalens/
├── client/                React app (Vite, Tailwind)
│   └── src/ api/ context/ components/ pages/
├── server/                Express API
│   ├── src/ routes/ services/ middleware/ models/ utils/
│   └── tests/             unit tests and API tests
├── sample-data/           example CSV
├── docs/screenshots/
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## License

GPT
