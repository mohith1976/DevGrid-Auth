# DevGrid

DevGrid is a **developer collaboration and project-building platform** that connects developers based on skills, GitHub achievements, and project requirements.  
It is a **full ecosystem** where developers can propose projects, form teams, collaborate, communicate, and contribute to open-source together.  

---

## Core Concept of DevGrid

### 1. Project Proposals by Developers
Any developer can create a **project proposal** with detailed entry requirements such as:

- Minimum number of repositories  
- Minimum GitHub contributions  
- Minimum GitHub profile level (DevGrid score)  
- Required programming languages or tech-stack proficiency  
- Experience, badges, or certifications  

This ensures that people joining the project match the expected skill level.

---

### 2. Developer Matching System
Users browsing proposals can **apply to join** only if their profile matches the requirements.  

DevGrid automatically checks:

- GitHub stats  
- Contribution history  
- Language proficiency  
- Reputation / DevGrid profile level  
- Achievements and certifications  

If a user meets the criteria, their application is sent to the **project owner**.

---

### 3. Application Approval System
The project owner can:

- Accept  
- Reject  

If accepted, DevGrid automatically:

- Creates a project team  
- Creates a shared workspace for collaboration  
- Links the team to their GitHub repo (or auto-creates one)  

---

### 4. Team Workspace & Collaboration
Inside the team workspace, members can:

- Chat in real-time  
- Assign tasks and manage issues  
- Share documents and resources  
- Track contributions and code reviews  
- Collaborate on GitHub repository together  

---

### 5. Open-Source Contribution Pool
Teams can publish their projects to the **DevGrid Open Source Pool**, where:

- Other developers can browse and clone repositories  
- Contribute to existing projects  
- Learn from real-team collaborations  
- Improve their profile level by contributing  

This creates a **community-driven ecosystem** of open-source collaboration.

---
## Tech Stack & Deployment

- **Frontend:** React, TypeScript, Vite  
- **Backend:** Node.js, Express, NestJS  
- **Database:** PostgreSQL (Prisma, Supabase), MongoDB Atlas  
- **Caching & Queues:** Redis (local), Redis Cloud (Upstash), Bull  
- **Infrastructure & Deployment:** Docker, AWS EC2, AWS S3, AWS IAM, Vercel (frontend with domain digitaldevgrid.tech)  
- **ORM & Tools:** Prisma

## Technology Usage Breakdown
- React + Vite: Fast frontend development, modular components (Portfolio, Dashboard, LanguageSnapshot).
- NestJS: Structured backend APIs, controllers/services for profile, projects, teams, aggregations.
- Prisma: Database schema and migrations for Profile and related entities.
- Redis: In‑memory store for queues and caching intermediates.
- Bull: Background jobs to fetch/aggregate GitHub data (language counts, commits, PRs) asynchronously.
- Docker: Containerize services (frontend, backend, worker, database, redis) for reproducible environments.
- Axios: External API calls to GitHub and other services.

## Project Process Overview
1. User signs in and authorizes GitHub access (token stored locally for API calls).
2. Backend triggers aggregation jobs (Bull + Redis) to fetch repos, language usage, commits, PRs.
3. Aggregates are stored in the Profile model and/or cache; endpoints return cached results by default.
4. Frontend renders LanguageSnapshot donut chart, contributions summary, projects grid, and other sections.
5. Users can force a live refresh via query (e.g., `?force=1`) to re‑fetch GitHub data.
6. Team activity and notifications are derived from team messages, displayed on the portfolio/dashboard.

## Repository Structure
```
README.md
backend/
	package.json
	tsconfig.json
	prisma/
		schema.prisma
	src/
		app.module.ts
		main.ts
		prisma.service.ts
docs/
	architecture.md
frontend/
	index.html
	package.json
	tsconfig.json
	src/
		App.tsx
		main.tsx
		styles.css
		components/
			ProfilePage.tsx
			LanguageSnapshot.tsx
			DeveloperStats.tsx
			Dashboard.tsx
			Achievements.tsx
			Certifications.tsx
```

## Cloning & Installing
```powershell
# Clone
Push-Location "C:\Users\<you>"; git clone https://github.com/mohith1976/DevGrid.git

# Install frontend
Push-Location "C:\Users\<you>\DevGrid\frontend"; npm install

# Install backend
Push-Location "C:\Users\<you>\DevGrid\backend"; npm install
```

## Local Development Setup
### 1) Environment Variables
- Backend: create `.env` in `backend/` with DB and GitHub settings:
```
DATABASE_URL="postgresql://user:pass@localhost:5432/devgrid"
GITHUB_TOKEN="<your_personal_access_token>"
REDIS_URL="redis://localhost:6379"
```

### 2) Database
- Using Prisma:
```powershell
Push-Location "C:\Users\<you>\DevGrid\backend"; npx prisma migrate dev
```

### 3) Redis (for Bull queues)
- With Docker (recommended):
```powershell
docker run -d --name devgrid-redis -p 6379:6379 redis:7
```

### 4) Run Servers
```powershell
# Backend API
Push-Location "C:\Users\<you>\DevGrid\backend"; npm run start

# Frontend (Vite dev server)
Push-Location "C:\Users\<you>\DevGrid\frontend"; npm run dev
```

### 5) Optional: Docker Compose
- If a `docker-compose.yml` is added, start all services together:
```powershell
docker compose up -d
```

## Using the App
- Public home: `https://www.digitaldevgrid.tech/`
- Dashboard (authenticated): `https://www.digitaldevgrid.tech/` after login.
- Standalone portfolio canvas (nav‑less): `https://www.digitaldevgrid.tech/portfolio`
- Public profile by username: `https://www.digitaldevgrid.tech/profile/<username>`

## Key Endpoints (Backend)
- `GET /auth/me` — Returns current user when authorized.
- `GET /api/projects/repos` — List repositories for the user.
- `GET /api/projects/profile/me` — Profile document + cached aggregate.
- `GET /api/projects/profile/aggregate` — Aggregate stats (can be forced fresh via `?force=1`).
- `POST /api/projects/trigger-agg` — Triggers background aggregation job.
- `GET /api/teams` — Teams and latest messages.

## Architecture Notes
- Controllers prefer cached aggregate from Profile to reduce GitHub calls.
- Aggregation computes per‑language repo counts and percentages; labels use language names.
- Enriched aggregate includes followers, starred count, open‑source contributions.
- SSE or polling can notify frontend when background jobs complete.

## Contributing
- Keep changes focused and minimal; follow the existing style.
- Run frontend/backend locally and verify before committing.
- Add/update docs in `docs/architecture.md` when making noteworthy changes.

## Roadmap
- Add contribution heatmap visualization.
- Expand achievements and certifications data models.
- Improve team collaboration features and real‑time updates.
- Add CI/CD and full Docker orchestration.

# DevGrid — Dev Portfolio & Collaboration Platform (scaffold)

This repository was cloned and scaffolded by the assistant.

Structure created for initial development:

- `frontend/` — React + TypeScript starter (Vite-style)
- `backend/` — NestJS-style starter with Prisma (Postgres) and Mongoose (MongoDB) placeholders
- `docs/architecture.md` — initial architecture notes

Notes:
- No Docker added (per request). We'll integrate later if needed.
- Backend will use `Postgres` (Prisma) for canonical user DB and `MongoDB Atlas` (Mongoose) for dynamic portfolio data.
- S3 is used for file storage (configuration placeholders included).

To continue: run package installs inside `frontend` and `backend` folders and configure environment variables based on `.env.example` files.

## Deployment & Operational Notes

This project has been deployed and tested on an EC2 host running the backend API. The following operational details describe the runtime choices and the production-friendly upload flow we implemented.

- Backend process: deployed on an EC2 instance and run with `pm2` (or `node dist/main.js`). Build then start commands used during deployment:
	- Build: `cd backend && npm install && npm run build`
	- Start (production): `pm2 start dist/main.js --name devgrid-backend` or `node dist/main.js`
	- To view logs: `pm2 logs devgrid-backend --lines 200`

- File uploads (S3 presigned flow):
	- The previous multer server-upload flow was replaced with an S3 presigned PUT approach to avoid storing binary blobs on the backend.
	- Flow: frontend requests a presigned URL from `POST /api/uploads/presign` → frontend uploads file directly to S3 using the returned URL (HTTP PUT) → frontend then POSTs the resource metadata (public S3 URL) to the backend (e.g. `POST /api/certifications`).
	- Important: presigned URLs are generated without ACLs (no `x-amz-acl`) to support buckets that enforce Object Ownership / disable ACLs.
	- The frontend was updated to remove any custom `x-amz-acl` header and only send `Content-Type` on PUTs.

- S3 CORS and browser uploads:
	- Browsers perform an OPTIONS preflight for PUT requests. You must configure the S3 bucket CORS to allow your frontend origin, and permit the actual methods used (GET, PUT, POST, HEAD).
	- Example CORS rule applied during testing (allow origins `https://www.digitaldevgrid.tech` and `http://<your-server-ip>`): AllowedMethods: `GET,PUT,POST,HEAD` and AllowedHeaders `*`.
	- If you do not want to use the AWS CLI on the server, a helper script `backend/scripts/set-s3-cors.js` (uses AWS SDK v3) was added to apply the CORS config using the same AWS env vars.

- Diagnostics and helper scripts (added to `backend/scripts`):
	- `test-s3.js` — tests presign + PUT using the backend `.env` values; useful to isolate server-side S3 permissions (bypasses browser CORS).
	- `set-s3-cors.js` — applies S3 CORS using the AWS SDK and values from `backend/.env` (no awscli required).

- Redis / Queues:
	- Background aggregation uses Bull and Redis. For the deployed instance we used a managed Upstash Redis (`REDIS_URL`) with TLS (`rediss://...`) configured in `.env`.
	- Ensure `REDIS_URL` is present in `backend/.env` for queue processing and background workers.

- Databases:
	- Canonical user data: PostgreSQL (Supabase) accessed via `DATABASE_URL` (Prisma). In production the project uses the Supabase Postgres connection string.
	- Dynamic portfolio documents: MongoDB (Atlas) is used for some services and models — configured via `MONGO_URI` / `MONGO_DB` in `.env`.

## Important environment variables
Set these in `backend/.env` (do not commit secrets):

- `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_REGION`, `AWS_BUCKET` — S3 credentials and bucket name.
- `REDIS_URL` — Redis connection for Bull queues (e.g., Upstash `rediss://...`).
- `DATABASE_URL` — Postgres connection (Supabase) for Prisma migrations and canonical data.
- `MONGO_URI`, `MONGO_DB` — optional MongoDB Atlas connection for document storage.
- `JWT_SECRET` — signing key for auth tokens.

## Troubleshooting file uploads
- If browser uploads fail with "Network Error":
	1. Run `node backend/scripts/test-s3.js` on the server — if that succeeds, the backend and S3 credentials are fine and the problem is CORS.
	2. Ensure `backend/scripts/set-s3-cors.js` or an equivalent `aws s3api put-bucket-cors` call has been executed to allow your frontend origin.
	3. Confirm the frontend is not sending `x-amz-acl` header — the client should only send `Content-Type` when PUTting to the presigned URL.

## Notes & Next Steps
- The upload flow reduces backend storage and scales better for large files.
- Consider tightening the S3 bucket policy and object ownership rules once the workflow is stable.
- Optionally add a `pm2` ecosystem file and `systemd`/startup script to ensure backend restarts on reboot.

If you want, I can:
- Commit these changes and open a PR.
- Add a `pm2` ecosystem file and demonstrate pm2 startup commands.
- Harden S3 bucket policy and add IAM role recommendations for long-term secure deployment.
