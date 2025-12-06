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
