# DevGrid Authentication Service Deployment Guide

Version: 2.1

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the deployment architecture for DevGrid Authentication Service.

The deployment architecture must remain:

* Simple
* Secure
* Maintainable
* Independently Deployable

The authentication service exists solely to support GitHub OAuth authentication.

It is not a backend platform.

It is not a product service.

It is not a repository synchronization service.

---

# Deployment Goals

The deployment architecture must:

* Support GitHub OAuth
* Protect OAuth secrets
* Minimize operational complexity
* Support independent deployment
* Support production reliability

---

# Production Deployment

Production Environment:

auth.digitaldevgrid.tech

---

Deployment Platform:

Render

---

Authentication Service:

DevGrid-Auth

---

# Deployment Architecture

DevGrid Extension
↓
Authentication Service
(auth.digitaldevgrid.tech)
↓
GitHub OAuth

---

Repository Operations

DevGrid Extension
↓
GitHub

---

The authentication service is not involved in repository operations.

---

# Hosting Strategy

Hosting Provider:

Render

---

Service Type:

Web Service

---

Runtime:

Node.js

---

Framework:

NestJS

---

Deployment Model:

Git Push
↓
Render Build
↓
Render Deploy

---

# Domain Configuration

Production Domain:

auth.digitaldevgrid.tech

---

Purpose:

Authentication Infrastructure

---

Requirements:

* HTTPS Enabled
* Valid TLS Certificate
* Publicly Accessible

---

# Environment Configuration

All configuration must be environment-driven.

Do not hardcode:

* Secrets
* Domains
* OAuth Credentials
* Runtime Configuration

---

# Required Environment Variables

## NODE_ENV

Purpose:

Runtime Environment

---

Example:

```env id="vff7d0"
NODE_ENV=production
```

---

## GITHUB_CLIENT_ID

Purpose:

GitHub OAuth Client ID

---

Example:

```env id="kgm1cx"
GITHUB_CLIENT_ID=xxxxxxxx
```

---

## GITHUB_CLIENT_SECRET

Purpose:

GitHub OAuth Client Secret

---

Example:

```env id="uvv0sn"
GITHUB_CLIENT_SECRET=xxxxxxxx
```

---

## AUTH_SERVICE_URL

Purpose:

Authentication Service Base URL

---

Example:

```env id="emfxa0"
AUTH_SERVICE_URL=https://auth.digitaldevgrid.tech
```

---

## SESSION_SECRET

Purpose:

Authentication Security Secret

Used for authentication lifecycle operations when required.

---

Example:

```env id="md6tt0"
SESSION_SECRET=xxxxxxxx
```

---

# Local Development Configuration

Example:

```env id="tbiv0j"
NODE_ENV=development

PORT=3000

GITHUB_CLIENT_ID=xxxxxxxx

GITHUB_CLIENT_SECRET=xxxxxxxx

AUTH_SERVICE_URL=https://auth.digitaldevgrid.tech

SESSION_SECRET=xxxxxxxx
```

---

# Render Configuration

Required Variables:

```text id="b6uxx4"
NODE_ENV

GITHUB_CLIENT_ID

GITHUB_CLIENT_SECRET

AUTH_SERVICE_URL

SESSION_SECRET
```

---

Do not commit secrets.

Do not store production credentials in source control.

---

# Build Requirements

Deployment must fail if:

* Required environment variables are missing
* Configuration validation fails
* Application bootstrap fails

Fail fast.

Do not allow partially configured deployments.

---

# Health Monitoring

Authentication Service must expose:

```text id="1xrn9u"
GET /api/v1/health
```

---

Expected Response:

```json id="srtq34"
{
  "success": true,
  "service": "devgrid-auth",
  "status": "healthy"
}
```

---

Purpose:

* Deployment Validation
* Runtime Monitoring
* Operational Verification

---

# Logging Requirements

Allowed:

* Startup Events
* Deployment Events
* Authentication Events
* Operational Diagnostics

---

Forbidden:

* OAuth Access Tokens
* OAuth Client Secrets
* Authorization Codes
* Internal Secrets

---

# Scaling Philosophy

The authentication service should remain lightweight.

The service exists only to support authentication.

Avoid introducing:

* Databases
* Analytics Platforms
* Background Workers
* Repository Processing Pipelines
* Product Services

unless explicitly approved through architecture review.

---

# Operational Responsibilities

Authentication Service Owns:

* OAuth Authentication
* OAuth Callback Handling
* Token Exchange
* Authentication Validation
* Authentication Lifecycle

---

DevGrid Extension Owns:

* Repository Discovery
* Repository Synchronization
* Commit Creation
* File Updates
* Product Features
* User Workflows

---

# Disaster Recovery

If the authentication service becomes unavailable:

Expected Impact:

* New logins may fail
* Reauthentication may fail

---

Repository Operations already in progress remain unaffected.

Reason:

Repository operations occur directly between:

DevGrid Extension
↓
GitHub

---

# Explicitly Out Of Scope

The deployment architecture must not support:

* Repository Synchronization
* Submission Processing
* Analytics
* Statistics
* Product Features
* GitHub Repository Management

These belong to:

DevGrid Extension

---

# Deployment Success Criteria

A successful deployment:

* Supports GitHub OAuth
* Protects OAuth secrets
* Remains independently deployable
* Remains easy to operate
* Remains easy to audit
* Maintains architectural boundaries

Users should be able to:

Install Extension
↓
Sign In With GitHub
↓
Select Repository
↓
Use DevGrid

without knowing the authentication service exists.

The best deployment is stable, secure, boring, and rarely requires attention.
