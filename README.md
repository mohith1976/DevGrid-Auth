# DevGrid Authentication Service

Production-ready authentication infrastructure for DevGrid.

## Purpose

This service provides secure GitHub OAuth authentication infrastructure. It is not the DevGrid product—it exists solely to support secure GitHub OAuth authentication for the DevGrid Extension.

## Project Status

**Phase**: Phase 4A - OAuth Infrastructure (Foundational)

**Current Implementation**: Service skeleton with configuration management and health monitoring.

## Architecture

```
src/
├── main.ts                 # Application entry point
├── config/                 # Configuration management
│   └── index.ts           # Environment validation and loading
├── routes/                 # API endpoints
│   ├── index.ts           # Route exports
│   └── health.ts          # Health check endpoint
├── services/              # Service implementations (future)
│   ├── index.ts
│   ├── auth/              # Authentication service
│   ├── oauth/             # GitHub OAuth integration
│   └── session/           # Session management
├── middleware/            # Express middleware (future)
├── domain/                # Domain models and types (future)
└── utils/                 # Utility functions (future)
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and populate required variables:

```bash
cp .env.example .env
```

Required environment variables:
- `NODE_ENV` - Deployment environment (development, staging, production)
- `PORT` - Service port (default: 3000)
- `GITHUB_CLIENT_ID` - GitHub OAuth application client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth application client secret
- `AUTH_SERVICE_URL` - Service URL for OAuth callbacks
- `FRONTEND_URL` - Frontend URL for CORS
- `SESSION_SECRET` - Secret for session management

### Development

```bash
npm run dev
```

Starts the development server with hot reload.

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in `dist/` directory.

### Production

```bash
npm run start:prod
```

Starts the compiled service.

## API Endpoints

### Health Check

**GET** `/api/v1/health`

Returns service health status. No authentication required.

Response:
```json
{
  "success": true,
  "service": "devgrid-auth",
  "status": "healthy"
}
```

## Security

- No secrets committed to source control
- All secrets managed through environment variables
- HTTPS enforced for all communication
- No placeholder authentication logic
- Configuration validation on startup

See `docs/SECURITY_MODEL.md` for detailed security architecture.

## Deployment

This service is deployable to Render and other standard Node.js hosting platforms.

### Build Command
```bash
npm install
npm run build
```

### Start Command
```bash
npm run start:prod
```

See `docs/DEPLOYMENT.md` for detailed deployment instructions.

## Documentation

- `docs/AUTH_FLOW.md` - Complete authentication flow documentation
- `docs/API_CONTRACT.md` - API endpoint contract
- `docs/SECURITY_MODEL.md` - Security model and threat analysis
- `docs/DEPLOYMENT.md` - Deployment architecture
- `instruction.md` - Service constitution and governance
- `v2-planning.md` - Development roadmap

## Scope

**Phase 4A implements:**
- Service foundation and configuration management
- Environment validation
- Health monitoring endpoint
- Deployment readiness

**Explicitly Not Implemented (Phase 4B):**
- OAuth login flow
- OAuth callback handling
- OAuth token exchange
- GitHub API communication
- Session management
- Database integration

## Project Structure

This service adheres to the approved architecture defined in `instruction.md`. No alternative architectures are permitted without explicit approval.

### Core Principles

1. **Authentication Only** - Every feature must directly support authentication
2. **No Product Logic** - Product logic belongs in devgrid-extension
3. **No GitHub Proxy** - The service never proxies repository operations
4. **Secret Ownership** - All authentication secrets remain in this service
5. **Infrastructure Minimalism** - Keep the service as small as possible
6. **Security Before Convenience** - When conflicts arise, security wins
7. **Independent Deployability** - No source-code dependencies on devgrid-extension

## License

MIT

## Support

For issues related to the authentication service, refer to the documentation files in `docs/` directory.
