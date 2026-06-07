# Quick Start Guide - DevGrid Authentication Service

## Setup (First Time)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your GitHub OAuth credentials
# Obtain from: https://github.com/settings/applications/new
```

**Required in .env:**
```
NODE_ENV=development
PORT=3000
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
AUTH_SERVICE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=generate_a_strong_random_string
```

## Development

```bash
# Run with hot reload
npm run dev

# Server starts at: http://localhost:3000
# Health check: http://localhost:3000/api/v1/health
```

## Build & Production

```bash
# Build the service
npm run build

# Start in production
npm run start:prod
```

## Verification

```bash
# Check service is healthy
curl http://localhost:3000/api/v1/health

# Expected response:
# {"success":true,"service":"devgrid-auth","status":"healthy"}
```

## Troubleshooting

**Service won't start?**

Check for clear error message:
```
Initializing configuration...
Startup failed: Missing required environment variable: GITHUB_CLIENT_ID
```

Ensure all required variables are in `.env`:
- NODE_ENV
- PORT
- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET
- AUTH_SERVICE_URL
- FRONTEND_URL
- SESSION_SECRET

**Port already in use?**

Change PORT in `.env` (default: 3000)

**Build errors?**

```bash
# Clean build
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

## Project Structure

```
src/
├── main.ts              # Entry point
├── config/              # Configuration management
├── routes/              # API endpoints
├── services/            # Service layer
│   ├── auth/           # Authentication (Phase 4B)
│   ├── oauth/          # OAuth integration (Phase 4B)
│   └── session/        # Sessions (Phase 4B)
├── middleware/         # Middleware
├── domain/             # Domain models
└── utils/              # Utilities
```

## API Endpoints

### Health Check
- **GET** `/api/v1/health`
- Response: `{"success": true, "service": "devgrid-auth", "status": "healthy"}`

More endpoints coming in Phase 4B.

## Documentation

- **README.md** - Full project overview
- **docs/AUTH_FLOW.md** - Authentication flow
- **docs/API_CONTRACT.md** - API definitions
- **docs/SECURITY_MODEL.md** - Security details
- **docs/DEPLOYMENT.md** - Deployment guide
- **PHASE_4A_COMPLETION.md** - Phase 4A summary

## Commands Reference

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript
npm run dev        # Run in development
npm run start:prod # Run production build
npm run clean      # Remove dist/ directory
```

## Environment Values

| Variable | Example | Notes |
|----------|---------|-------|
| NODE_ENV | development | development, staging, or production |
| PORT | 3000 | Port number for service |
| GITHUB_CLIENT_ID | abc123def456 | From GitHub OAuth settings |
| GITHUB_CLIENT_SECRET | secret_key_here | From GitHub OAuth settings |
| AUTH_SERVICE_URL | http://localhost:3000 | URL for OAuth callbacks |
| FRONTEND_URL | http://localhost:3000 | Extension/frontend URL |
| SESSION_SECRET | strong_random_string | Secret for session management |

## GitHub OAuth Setup

1. Go to https://github.com/settings/applications/new
2. Create new OAuth Application
3. Set:
   - **Authorization callback URL**: `{AUTH_SERVICE_URL}/api/v1/auth/callback` (Phase 4B)
4. Copy Client ID and Secret to `.env`

## Deployment

The service is ready to deploy to any Node.js platform:

- Render
- Heroku
- AWS Lambda
- GCP Cloud Run
- Azure Container Instances

Requires environment variables to be set in platform configuration.

## Support

See full documentation in project README and docs/ directory.

Phase 4A is foundational. Phases 4B and 4C will add authentication functionality.
