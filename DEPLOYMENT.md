# Production deployment

This application uses Vercel for the React/Vite client, one Render Free Node/Express process for the API, and MongoDB Atlas M0 for durable storage. Deployment never runs the demo seed or roster importers.

## Hosting configuration

Both projects use the repository root (leave Root Directory blank).

The production preparation is on `codex/production-deployment`. Render deploys this branch explicitly; updating `main` alone does not update the API. Backend automatic deployment remains disabled because releases require a maintenance window.

| Setting           | Vercel                         | Render                                 |
| ----------------- | ------------------------------ | -------------------------------------- |
| Framework/runtime | Vite, Node 24.x                | Node 24.21.0                           |
| Install/build     | `npm ci`, then `npm run build` | `npm ci --workspace server --omit=dev` |
| Output/start      | `client/dist`                  | `npm start --workspace server`         |
| Health            | Load the site                  | `/api/health`                          |

`vercel.json` supplies the SPA fallback for direct navigation and refreshes under `/app/*`. Only `client/dist` is served publicly. The localhost Vite proxy is development-only. `render.yaml` documents the backend service, region and free plan. No filesystem writes are needed by the deployed API; PDF fonts and images ship with the repository.

## Environment variables

Set in hosting dashboards or authenticated tools, never in Git:

| Service           | Variable        | Value                                                           |
| ----------------- | --------------- | --------------------------------------------------------------- |
| Vercel Production | `VITE_API_URL`  | `https://<render-service>.onrender.com/api`                     |
| Render            | `MONGODB_URI`   | Atlas TLS URI including `/wwc_real` and database credentials    |
| Render            | `JWT_SECRET`    | Unique random secret, at least 32 characters                    |
| Render            | `CLIENT_ORIGIN` | Exact `https://<frontend>.vercel.app` origin; no trailing slash |
| Render            | `NODE_ENV`      | `production`                                                    |
| Render            | `TRUST_PROXY`   | `1` for the Render reverse proxy                                |
| Render            | `NODE_VERSION`  | `24.21.0`                                                       |
| Render            | `TZ`            | `Asia/Kolkata`                                                  |
| Render            | `PORT`          | Supplied by Render automatically                                |

`VITE_*` values are public and embedded at build time. Changing the API URL requires a frontend redeploy. Do not give preview frontends production credentials or add wildcard preview domains to production CORS. Tokens use the Authorization header; cross-site cookies are not required.

## Safe migration of existing data

1. Stop the local API and all imports so the source remains unchanged throughout the copy. Record which database contains the real records. This workspace's built-in persistent mode uses `.data/mongodb`, database `wwc_real`, port 27018. A regular server may use a different URI; do not assume it contains the same data.
2. With MongoDB stopped, keep an offline copy of `.data/mongodb`. Keep `private/` account handover material separately, with restricted permissions. Never publish either directory.
3. Start only MongoDB (not the API or any importer). Install official MongoDB Database Tools and record a read-only manifest:

   ```sh
   node scripts/database-manifest.js --uri-env SOURCE_MONGODB_URI --out backups/source-manifest.json
   ```

   Supply `SOURCE_MONGODB_URI` privately in the process environment. Output paths must be new; the verifier refuses to overwrite files. Manifests include document counts, SHA-256 hashes of raw BSON sorted by `_id`, collection options and indexes, without document contents.

4. Dump the explicit application database to a gzip archive using `mongodump`. For the local unauthenticated source:

   ```sh
   mongodump --uri=mongodb://127.0.0.1:27018/wwc_real --archive=backups/wwc_real.archive.gz --gzip
   ```

   For credential-bearing URIs use a mode-600 MongoDB Tools YAML config file with a `uri` field and `--config=private/source-tools.yml`. Never put a secret URI in command arguments, shell history or logs.

5. Use a dedicated Atlas project and free cluster. Create a database user with `readWrite` only on `wwc_real`. Allow only Render's actual outbound CIDR ranges plus a temporary workstation IP for migration. Do not allow the entire internet. Store the target URI privately. Confirm the target has **zero collections** before restoring. An existing target requires review; do not merge, overwrite or use `--drop`.
6. Save the target URI in a mode-600 config file (`private/atlas-tools.yml`) and restore:

   ```sh
   mongorestore --config=private/atlas-tools.yml --archive=backups/wwc_real.archive.gz --gzip --nsInclude='wwc_real.*' --stopOnError
   ```

   Keep Render stopped until verification passes. Do not run seed or source importer scripts. An interrupted or failed restore may leave a partial target: stop and investigate, never rerun blindly or delete it automatically.

7. Set `TARGET_MONGODB_URI` privately, then verify:

   ```sh
   node scripts/database-manifest.js --uri-env TARGET_MONGODB_URI --out backups/target-manifest.json
   node scripts/database-manifest.js --compare backups/source-manifest.json backups/target-manifest.json
   ```

   All counts, hashes, indexes and options must match before cutover. This verifies member IDs, password hashes, roles, departments, profiles, participation, binary workbook archives and other stored records. It does not need plaintext passwords.

8. Configure Render with the verified Atlas URI, deploy and check `/api/health`. Verify real administrator, head and volunteer logins privately, and department scoping. Remove the temporary workstation network entry after verification, retaining Render outbound ranges. Keep backups offline and private. Do not restart the local API with writes after cutover.

## Capacity protection and future backend releases

Approval, assignment and event-capacity edits share a single in-process queue. Keep **one** Node process and one Render instance; do not add PM2 clustering or replicas. Render can overlap old and new instances during a deployment, so automatic backend deployment is disabled.

Render's built-in maintenance mode is available only on paid web services. On this Free service, future backend releases must use a stop-first maintenance window: suspend the service and confirm that its existing process has stopped before deploying/resuming the new revision. Verify the supported suspend/deploy/resume sequence in Render before releasing; do not use an ordinary rolling deploy while approvals or assignments can be in flight. On a paid service, enable maintenance mode and drain requests before deployment, retaining it through old-instance shutdown. Multi-instance availability requires database-level concurrency protection and is outside this deployment's scope.

Render Free can sleep after inactivity and shares free usage limits with other services in the same workspace. Atlas Free is limited to 512 MB and needs manual backups. Vercel Hobby eligibility is governed by its personal/non-commercial terms; no paid plan is selected automatically.

## Verification

Run `npm run build` and `npm test`. The suite uses isolated temporary MongoDB databases, including production configuration tests. It covers registration/login, role restrictions, department isolation, password changes, member activation, RP and contributions, approvals including concurrent capacity edits, attendance corrections, certificates and PDF downloads, CORS preflight, proxy rate limiting, health readiness and migration manifest sensitivity.

For a live release, additionally check frontend deep-link refreshes, browser network requests and PDF viewer loading. Exercise write workflows in an isolated verification database before opening the real member database to users. Never run the test suite against production data.
