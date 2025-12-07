# DevGrid

DevGrid is a developer portfolio and collaboration platform that helps engineers showcase their work, visualize contributions, track achievements/certifications, and collaborate on team projects. It integrates with GitHub to aggregate language usage, repositories, commits, pull requests, and open-source activity, and provides a modern UI for personal portfolios and dashboards.

## What Is DevGrid
- A clean portfolio canvas to present a developer’s profile, skills, projects, and stats.
- A dashboard to monitor contributions, PR trends, open‑source projects, and team activity.
- Backend services aggregate GitHub data, cache results, and expose APIs for the frontend.
- Achievements and certifications modules to highlight milestones and credentials.

## Features Built So Far
- Portfolio page: Hero, Skills snapshot (donut chart), Contribution summary, Projects grid, Achievements, Certifications, Team projects, Notifications.
- Dashboard: Developer stats with modern UI; language distribution; open‑source contributions view.
- Backend aggregation: Per‑repository language counts, total commits, PRs, followers, starred repos, open‑source contributions.
- Caching: Profile aggregates stored to avoid hitting GitHub on every visit; force refresh via query flag.
- Team modules: List teams, members, recent notifications derived from team messages.

## Tech Stack
- Frontend: React + Vite + TypeScript.
- Backend: NestJS (TypeScript), Axios for GitHub API, Prisma (for DB schema), Mongoose (if applicable in services), Express/Nest controllers.
- Database: PostgreSQL (Prisma) and/or MongoDB (if used in specific services).
- Infrastructure & Workers: Docker, Redis, Bull queue for background aggregation tasks.
- Tooling: ESLint/TSConfig, esbuild/Vite dev server.

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
- Public home: `http://localhost:5173/`
- Dashboard (authenticated): `http://localhost:5173/` after login.
- Standalone portfolio canvas (nav‑less): `http://localhost:5173/portfolio`
- Public profile by username: `http://localhost:5173/profile/<username>`

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
