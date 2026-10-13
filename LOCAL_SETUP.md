# Run Warriors Without Cause locally

This guide starts the app from a fresh clone. It covers a disposable demo and a persistent local database. The demo users created by the seed are sample accounts; the private member database and account handover are not part of this repository.

## Requirements

- Node.js 20.19 or later (or Node.js 22.12 or later) and npm. Node 24 is also supported.
- Docker Desktop for the persistent database option. The demo option downloads its own temporary MongoDB binary on its first run and needs internet access.
- Git.

Check the installed tools:

```sh
node --version
npm --version
git --version
docker --version
```

## 1. Clone and install

Run these commands in Terminal, PowerShell, or another shell:

```sh
git clone https://github.com/Parthmudgal15105/NgoVolunteer.git
cd NgoVolunteer
npm ci
```

`npm ci` installs the exact dependency versions from `package-lock.json`. If you intentionally change dependencies, use `npm install` and commit the updated lockfile.

## 2. Quick seeded demo (data resets when stopped)

This is the fastest way to try both administrator and volunteer screens. It does not need Docker or an installed MongoDB service.

Open **Terminal 1** in the project directory and start the seeded API and temporary database:

```sh
node scripts/preview.js
```

Wait until it prints that the preview API is ready on port 5001. Keep that terminal open.

Open **Terminal 2**, also in the project directory, and start the web app:

```sh
npm run dev -w client -- --host 127.0.0.1
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Sign in with one of the sample accounts:

| Role | Login | Password |
| --- | --- | --- |
| Administrator | `admin@kindred.org` | `Volunteer@123` |
| Volunteer | `maya@example.com` | `Volunteer@123` |

Stop both processes with **Ctrl+C**. This demo database is temporary; its records are discarded when the API stops. Do not run another API on port 5001 at the same time.

## 3. Persistent local database (recommended for development)

### Start MongoDB

Start a Docker container with a persistent volume:

```sh
docker run -d --name ngo-mongo -p 27017:27017 -v ngo-mongo-data:/data/db mongo:8
```

Confirm it is running:

```sh
docker ps
```

### Configure the API

On macOS or Linux:

```sh
cp server/.env.example server/.env
```

In Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

Generate a private JWT key:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Open `server/.env` in a text editor and replace the example `JWT_SECRET` with the generated value. For the Docker command above, use these settings:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ngo_volunteer
JWT_SECRET=paste-the-generated-value-here
PORT=5001
CLIENT_ORIGIN=http://localhost:5173
```

Keep `server/.env` private; it is ignored by Git. The MongoDB URI above is for the local container without authentication. For MongoDB Atlas or an authenticated server, use its connection URI and database name instead.

### Seed and run the app

Seed the clean database with sample accounts and events:

```sh
npm run seed
```

Start both API and frontend:

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API health check is [http://localhost:5001/api/health](http://localhost:5001/api/health). Use the sample logins from the table above. The MongoDB volume preserves data after the app stops and starts again.

Stop the app with **Ctrl+C**. Stop MongoDB when needed with:

```sh
docker stop ngo-mongo
```

Start it again later with:

```sh
docker start ngo-mongo
npm run dev
```

Do not run `npm run seed` against a database containing real member data. On a fresh database, the seed creates one administrator, five volunteers, events, sample participation, and announcements. It skips creation if `admin@kindred.org` already exists.

## 4. Built-in persistent local mode

The project also includes a disk-backed local MongoDB mode. It downloads the MongoDB executable on first use and stores its files under `.data/mongodb`:

```sh
npm run local
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). This starts an empty persistent database on a fresh clone; public registration creates volunteer accounts. Use the Docker and seed steps above if you need sample administrator access. Stop the local mode before starting another API on port 5001. Do not run it against the same MongoDB files from two processes at once.

## 5. Common commands

Run from the project root:

```sh
npm run build       # production-build the frontend
npm test            # run integration tests using a separate temporary database
npm run seed        # insert sample records into the MONGODB_URI in server/.env
npm run dev         # start API and frontend against server/.env MongoDB
npm run local       # start the bundled persistent local database and frontend
```

`npm run dev` and `npm run local` both use port 5001 for the API and port 5173 for the frontend. Run only one API mode at a time. The regular `npm run dev` mode connects to the MongoDB URI from `server/.env`; `npm run local` uses `.data/mongodb` instead.

## Troubleshooting

- **The page opens but data will not load:** make sure the API terminal says it is listening on port 5001 and check `/api/health` at `http://localhost:5001/api/health`.
- **MongoDB connection failed:** check that Docker shows `ngo-mongo` as running and that `MONGODB_URI` uses port 27017. The built-in local mode uses port 27018 internally.
- **JWT secret error:** replace the placeholder in `server/.env` with a value generated by the command above; it must be at least 32 characters.
- **Port already in use:** stop the other app/API process before starting another mode. The web app uses 5173 and the API uses 5001.
- **First start takes a while:** `mongodb-memory-server` downloads a MongoDB binary on first use; allow the download to finish, then retry the start command.
- **Login fails after reseeding:** confirm the app is connected to the database you seeded. The demo password is case-sensitive: `Volunteer@123`.

## Private organization data

The real roster files, account passwords, database files, and imported records are excluded from this GitHub repository. A fresh clone starts with no real member data. Follow the sample demo steps above for local testing. The optional private database integration requires separate source files and account credentials; those files must be supplied privately and must never be committed.
