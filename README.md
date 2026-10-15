# Warriors Without Cause — NGO Volunteer Management System

A complete MERN application for NGOs to organise opportunities, manage volunteer applications, record attendance, track hours, and issue PDF participation certificates. The interface includes public pages and separate administrator and volunteer workspaces, styled to match the supplied NGO walkthrough.

For a complete fresh-machine setup with copyable commands, see [LOCAL_SETUP.md](LOCAL_SETUP.md). It covers the disposable demo, persistent Docker-backed development, seed accounts, and troubleshooting.

For Vercel, Render and Atlas production settings, safe database migration, and release verification, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Features

- Volunteer registration, password hashing with bcrypt, JWT sessions, and server-side role checks.
- Profiles with skills, interests, phone, biography, and availability.
- Searchable events with cause filters, details, capacity, dates, and duration.
- Pending applications, administrator approval/rejection, direct assignments, and personal notifications.
- Attendance and derived hour totals; repeated attendance updates never add duplicate hours.
- Reward points for attended drives and eligible Social & Content contributions, with per-member totals for volunteers and department heads.
- Automatic certificates for present volunteers once an event is completed; downloadable PDF files with unique IDs.
- Volunteer account activation/deactivation and community announcements.
- Database-backed dashboards, six-month contribution charts, cause breakdowns, attendance percentages, and certificate counts.
- Responsive navigation, validation, loading/empty/error states, and feedback messages.

## Technology

React, Vite, React Router, Axios, Recharts, Lucide React, Node.js, Express, MongoDB, Mongoose, JWT, bcrypt, and PDFKit. JavaScript throughout.

## Prerequisites

- Node.js 20.19+ or 22.12+ (tested with Node 24).
- npm.
- MongoDB Community running locally, Docker with MongoDB, or a MongoDB Atlas connection string.

## Install and configure

Run from this project directory:

```sh
npm install
cp server/.env.example server/.env
```

Edit `server/.env`:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ngo_volunteer
JWT_SECRET=your-unique-random-secret-at-least-32-characters
PORT=5001
CLIENT_ORIGIN=http://localhost:5173
```

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Start your local MongoDB service, or use Docker:

```sh
docker run -d --name kindred-mongo -p 27017:27017 -v kindred-mongo-data:/data/db mongo:8
```

For Atlas, replace `MONGODB_URI` with your connection string, including a database name; configure your database user and permitted IP addresses. Keep credentials out of Git.

Then seed and launch:

```sh
npm run seed
npm run dev
```

Open http://localhost:5173. The API runs at http://localhost:5001/api. Vite proxies `/api` requests to that API. `client/.env.example` documents the optional `VITE_API_URL`; it is only needed when hosting the frontend separately. Changing the API port also requires updating the proxy in `client/vite.config.js`.

For separate terminals:

```sh
npm run dev -w server
npm run dev -w client
```

## Demo credentials

All demo accounts use **Volunteer@123**.

| Role | Email |
| --- | --- |
| Administrator | admin@kindred.org |
| Volunteer | maya@example.com |
| Volunteer | rohan@example.com |
| Volunteer | ananya@example.com |
| Volunteer | kabir@example.com |
| Volunteer | isha@example.com |

The seed creates one administrator, five volunteers, eight realistic events, applications, attendance, certificates, notifications, and two announcements. Dates are relative to the day the seed runs. It does not delete existing data; it skips seeding when the demo administrator already exists. Use a fresh database to recreate the full dataset. Demo credentials are for local development only.

## Main workflow

1. Register a volunteer, or sign in with a demo account.
2. Browse events, open details, and apply to an upcoming event. Status begins as pending.
3. Sign in as administrator. Open Applications and approve or reject the request. Approval assigns the volunteer and sends a notification. The Volunteers page also supports direct assignment.
4. After the event's scheduled date and time, open Attendance and mark the approved volunteer present or absent. Present records receive exactly the event's configured hours; absent records receive zero.
5. Open the event details and choose Complete event. Eligible certificates are issued automatically. Attendance entered after completion also generates eligible certificates.
6. The volunteer can view hours, participation, and certificates, then download a PDF.
7. Reopen the Overview or Reports page to see updated totals.

For immediate attendance/certificate testing, create an event in the future, apply and approve, then edit its date to a past time. You can also use completed seeded events to inspect attendance and existing certificates.

Attendance corrections update totals and invalidate certificates if someone becomes absent. Event duration cannot change once attendance is recorded. Events with applications cannot be deleted, preserving history. Applications close at the scheduled time; completion and attendance require that time to have passed.

## Validation and data integrity

Unique compound indexes prevent duplicate applications, attendance records, and certificates. Roles come from the database; public registration cannot set administrator privileges. Password hashes are excluded from queries and responses. Certificates are restricted to their owner or an administrator. Totals are derived from attendance, rather than incremented counters. Approval/assignment actions are serialized within one API process to avoid capacity oversubscription under concurrent requests. Run a single API instance for this mini-project; a multi-instance deployment would require transactional capacity reservations in MongoDB. Profile writes are restricted to the signed-in user. Inactive accounts cannot authenticate or use an existing session.

## API overview

Public: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/events`, `GET /api/announcements`, `GET /api/health`.

Authenticated: `/api/auth/me`, `/api/profile`, `/api/registrations`, `/api/attendance`, `/api/certificates`, `/api/certificates/:id/download`, `/api/notifications`, `/api/dashboard`.

Admin writes: event creation/editing/deletion/completion, registration decisions, `/api/assignments`, attendance writes, `/api/volunteers`, and announcement publishing/deletion. Protected requests use `Authorization: Bearer <token>`.

## Project structure

```text
client/src/
  components/Common.jsx # shared cards, states, badges, date formatting
  pages/App.jsx # routed pages and reusable UI components
  layouts/     # reserved for future layout extraction
  contexts/AuthContext.jsx
  services/api.js
  styles/index.css
server/
  app.js       # Express configuration
  index.js     # environment checks, database connection, startup
  seed.js
  models/index.js
  routes/api.js # router entry point
  controllers/apiController.js # REST handlers, validation, workflow orchestration
  middleware/auth.js
  config/db.js
  utils/certificates.js
tests/workflow.test.js
```

The small application deliberately keeps related handlers and page components together rather than creating a file per endpoint. No external AI APIs or paid services are used. The interface uses system fonts; certificate fonts are bundled locally with their licenses.

## Build and verification

```sh
npm run build
npm test
```

The integration tests start an isolated temporary MongoDB using `mongodb-memory-server`. The first run downloads a MongoDB binary and needs internet access. Tests exercise registration/login, role enforcement, event creation, duplicate application prevention, approval and notifications, capacity enforcement including concurrent approvals, attendance idempotency, accurate dashboards, certificate eligibility and PDF download, owner authorization, and attendance correction.

`npm run build` creates `client/dist`. Serve that directory with a static host that rewrites frontend routes to `index.html`, proxy `/api` to the backend, and set `CLIENT_ORIGIN` to the frontend origin. `npm start` starts the backend. Use HTTPS and unique secrets for a public deployment.

## Troubleshooting

- **MongoDB connection failed:** start MongoDB and verify `MONGODB_URI`, credentials, and Atlas network permissions.
- **JWT_SECRET error:** add a secret of at least 32 characters to `server/.env`.
- **Cannot connect in the UI:** ensure both development servers are running and MongoDB is connected.
- **Event is full:** only approved volunteers occupy capacity; rejecting an approved application releases a place before attendance exists.
- **Attendance unavailable:** the scheduled event date/time must have passed and the volunteer must be approved.
- **No certificate:** mark the volunteer present and complete the event. Refresh the Certificates page.
- **Port conflict:** stop the process using the port or update the server port and Vite proxy together.

Normal application data always persists in the configured MongoDB. Tests use an isolated disposable database and never touch your configured database.

## Disposable preview without installing MongoDB

Run `node scripts/preview.js` in one terminal and `npm run dev -w client` in another. The preview downloads and starts a temporary MongoDB binary and seeds it automatically. Its data is discarded when you stop the preview. For persistent real application data, follow the normal MongoDB configuration and `npm run dev` instructions above. Do not run the normal API and preview API simultaneously on port 5001.

## NGO branding and certificates

The interface uses the magenta sidebar, cream workspace, compact profile/stat cards, and warm login background from the supplied video. Registration includes phone number, password confirmation, and area of interest. These profile fields persist in MongoDB.

PDF certificates follow the supplied landscape certificate: magenta side borders, gold ribbon/seal, the supplied NGO logo, script recipient name, event contribution details, four trustee signatures, and the NGO registration footer. The signature row comes from the latest clearer certificate photo. Its original pixels are clipped into the PDF without redrawing the signatures. The volunteer name, hours, event, date, and unique certificate ID remain database-driven; sample recipient/award wording is not reused.

Certificate rendering is in `server/utils/renderCertificate.js`, with source assets and openly licensed fonts in `server/assets/`. The font license files are included. The certificate page provides an in-app PDF.js preview and a PDF download, so previewing does not depend on a browser's native PDF plugin. The PDF viewer is loaded only when requested.

To generate a local sample certificate for visual review:

```sh
node scripts/certificate-preview.js
```

The sample is written to `output/pdf/certificate-preview.pdf`. This script creates a clearly identified sample file and does not issue or insert database certificates.

## Persistent local database and imported accounts

`npm run local` runs the API and frontend against a disk-backed MongoDB on localhost port 27018. Data survives application restarts in `.data/mongodb`; the local JWT secret is generated once in `private/jwt-secret`. This mode binds the API, database, and frontend to localhost. Stop any existing demo preview before starting it. Back up `.data/mongodb` with MongoDB stopped, or use `mongodump` while it is running. The first run needs internet access to download the MongoDB executable.

The account importer reads a private extracted workbook at `private/imports/source.json` and the original XLSX at `private/imports/ngo-source.xlsx`. It uses the current `DATABASE 2026` roster, ignores department divider rows, merges repeated people only when both normalized name and email match, and retains multiple department memberships. Other worksheets remain original source records, visible to administrators under Imported records. The exact source workbook is also archived in MongoDB. RP/default metrics are never converted to attendance hours or certificates.

Run `npm run import:roster` for a count/review report. Stop the local API before running `npm run import:roster -- --apply`, since the importer starts the same disk-backed database. The importer generates a different random password per new account, stores bcrypt hashes in MongoDB, and writes a private credential journal for the account handover. Re-running does not reset passwords; it stops if the journal differs from existing passwords. Preserve the private credential file until handover is complete.

Access rules for the supplied roster:

- First four people are identified as founders.
- First seven people have full administrator access across the NGO.
- Remaining core-team members are department heads.
- Heads can view their departments’ volunteers, approve applications, assign events, record attendance, view reports and download their volunteers’ certificates. All these checks run on the server, including direct requests by record ID.
- Heads cannot manage other heads, founders, global event definitions, announcements, or original workbook records.
- Other current roster members receive volunteer accounts. A person listed in multiple departments is accessible to each applicable head.

Users can sign in with their email or unique Login ID. Shared or malformed source emails require Login ID. Users can change passwords in My Profile. Public registration always creates a volunteer account and cannot grant management access. Imported records without a department are visible to full administrators only until their membership is corrected.

The real workbook, credentials, generated handover XLSX, MongoDB files, private configuration, and review screenshots are excluded from this repository. A public clone contains application code and branding assets, with no real member accounts or database. Demo seeding is separate and must never be run against the real database.

## Final database integration

The October 2026 integration reads the supplied roster PDF, account handover, drive ODS, and request ODS. Extract privately with `scripts/extract-integration.py` using Python with `openpyxl` and `pypdf`, then run `npm run import:database` for review and `npm run import:database -- --apply` to import. Stop the local API first. The integration verifies the supplied account passwords against stored hashes before any member changes and preserves existing passwords and permissions. Private review results are saved in `private/imports/integration-review.json`.

Current member roles and profile details come from the final roster PDF. Multiple existing department memberships remain intact. Missing identities are preserved for review. Historical drive entries link only to a unique exact normalized member name; unmatched, incomplete and duplicate entries remain in Imported records. All supplied PDF and ODS files are archived privately in MongoDB. Certificate and department-change submissions remain source requests; they do not automatically change memberships, deactivate members, or issue certificates.

Attendance now includes **Drive & task contributions**, where administrators and department heads can record a member's activity, date, attendance, optional duration, and work notes. Heads can access only their department members; volunteers can read only their own records. The Volunteers table shows each member's drive/task counts and recorded activity hours. Blank historical durations remain unknown, and contribution records do not issue certificates or alter event attendance totals. Corrections update contribution totals, and repeat imports preserve corrections.
