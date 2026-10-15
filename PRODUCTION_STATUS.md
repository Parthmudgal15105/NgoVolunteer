# NGO production handoff

Deployed and verified on 15 October 2026. The UI and existing member data are preserved.

| Service  | Production destination                                                                  | Status                                               |
| -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Frontend | https://ngo-volunteer-management-eight.vercel.app                                       | Vercel production deployment READY; browser verified |
| Backend  | https://ngo-volunteer-api.onrender.com                                                  | Render Free, Singapore, one process; deployment live |
| Health   | https://ngo-volunteer-api.onrender.com/api/health                                       | HTTP 200; database connected                         |
| Database | Atlas project `ngo-volunteer-production`, cluster `ngo-production`, database `wwc_real` | M0 Free, Singapore; migration verified               |

Runtime source: backend commit `342bd62`; frontend commit `4760aa4`. Deployment preparation is pushed to `codex/production-deployment`. Documentation-only commits after these do not change deployed runtime code. Render automatic deployment is off to preserve the single-process approval lock. Vercel is deployed through the authenticated CLI; Git auto-deployment is not connected.

## Environment

All variables are configured in the hosting environment, with no credentials committed:

- Vercel Production: `VITE_API_URL=https://ngo-volunteer-api.onrender.com/api`.
- Render: private `MONGODB_URI` and `JWT_SECRET`; `CLIENT_ORIGIN=https://ngo-volunteer-management-eight.vercel.app`; `NODE_ENV=production`; `TRUST_PROXY=1`; `NODE_VERSION=24.21.0`; `TZ=Asia/Kolkata`. Render supplies `PORT`.

See `DEPLOYMENT.md` for root directories, build/start commands, backups and future-release procedures.

## Migration evidence

The original local database is retained, stopped, and backed up privately under `backups/pre-atlas-20261015T170019Z/`. Both an offline MongoDB file archive and a `mongodump` BSON archive were created before cutover.

All **11 collections and 6,318 documents** matched after restoration, including raw BSON hashes, indexes and collection options:

- 167 users and 167 volunteer profiles, preserving IDs, password hashes, roles and departments.
- 428 contributions, 5,552 source rows and four binary source archives.
- The original event, registration, attendance, certificate, announcement and notification collections were empty and remain empty.

A second comparison after live verification still matched the original source. No production data was seeded, overwritten, deleted or added. Local APIs/importers must remain stopped after cutover to avoid divergent databases.

## Verification

- Local production build passed. Eight tests passed, covering authentication, registration, department access, member activation, contributions/RP, concurrent approvals and capacity edits, attendance, certificate issuance/PDF downloads, production settings, CORS, proxy rate limiting, health and migration verification.
- Real existing administrator, department-head and volunteer accounts logged in through the deployed browser UI. Protected reads and role restrictions passed. API member/contribution results matched direct read-only Atlas queries.
- Direct dashboard links and refreshes passed for all three roles. Browser checks reported no JavaScript errors or network failures.
- The deployed certificate viewer rendered and downloaded a locally generated sample through browser-only fixtures. No real production certificate existed; generation and API downloads were exercised in isolated integration tests.
- Per the user's choice, live registration, approval, attendance and member edits were **not** performed against production.

Local evidence is in `output/deployment-qa/`; screenshots and private verification credentials are ignored by Git.

## Deferred security actions

The user requested a later reminder for these actions. They remain incomplete:

1. Revoke and replace the Render API key that appeared in a diagnostic error. The local `private/render-api-key` still contains the original key; its rotation has not been confirmed.
2. Restrict Atlas user `ngo-app` from `readWriteAnyDatabase` to `readWrite` on `wwc_real`, scoped to cluster `ngo-production`.
3. Rotate the Atlas database password that was shared in chat. A replacement has been generated privately in `private/atlas-new-password`, but it has **not** been applied. After resetting it in Atlas, update Render's `MONGODB_URI` and redeploy using a stop-first maintenance window, then check health and login again.
4. Remove the temporary workstation IP from Atlas Network Access when direct administration/verification is finished. Retain Render's actual outbound ranges: `74.220.52.0/24` and `74.220.60.0/24`. No whole-internet entry was created.

Free-tier limitations remain: Render can sleep after inactivity, and its allowance is shared with other services in the workspace. Atlas M0 needs manual backups. Backend releases need a maintenance window because the approval lock is process-local. No paid services were introduced.
