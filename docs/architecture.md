# DevGrid Architecture (initial)

This document captures the high-level architecture and sequence flows for the MVP.

Components
- Frontend (`frontend/`) — React + TypeScript SPA. Talks to backend API for auth, submissions, and profiles.
- Backend (`backend/`) — NestJS API. Handles GitHub OAuth, submission endpoints, job queue producers, and admin endpoints.
- Postgres (Prisma) — canonical user database storing `users` table and auth metadata.
- MongoDB Atlas (Mongoose) — stores dynamic portfolio collections: `projects`, `contributions`, `profile_stats`, `certifications`, `achievements`.
- Redis + BullMQ — background job queue for verification workers (to be added later).
- S3-compatible storage — stores uploaded files (certificates, images). Mongo stores only metadata and S3 link.

Sequence flows

1. GitHub Login
   - User clicks "Login with GitHub" on frontend.
   - Frontend redirects to backend OAuth endpoint; backend performs OAuth via GitHub and creates/updates `users` row in Postgres.
   - Backend returns session/auth token to frontend.

2. Project Submission
   - User submits a GitHub repo URL in the frontend.
   - Frontend calls backend `POST /submissions` endpoint.
   - Backend validates the URL, writes a `projects` document to Mongo, enqueues a verification job in Redis/BullMQ.

3. Verification Worker (background)
   - Worker pulls job from queue, calls GitHub REST/GraphQL to fetch commits/PRs.
   - Worker verifies whether the submitting user's GitHub ID appears in commit/PR authorship and constructs evidence.
   - Worker updates `projects` document and adds verified `contributions` documents; awards points and updates `profile_stats`.

4. File Uploads
   - Frontend uploads to a backend signed-upload endpoint that stores files in S3 and records metadata in Mongo `certifications`.
   - Admin can mark certifications as verified; points are awarded accordingly.

Notes & Next steps
- We'll start by scaffolding frontend and backend with minimal starter code, adding Prisma schema for Postgres and Mongoose schemas for dynamic collections.
- We'll defer worker and Redis setup until after auth and basic submission flows are functional.
