# DevGrid Authentication API Contract

Version: 2.1

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the public API contract exposed by DevGrid Authentication Service.

All communication between:

DevGrid Extension
↓
DevGrid Authentication Service

must occur through endpoints defined here.

Endpoints not defined in this document must not be implemented without architectural review and approval.

---

# API Philosophy

The authentication service exists solely to support authentication.

The authentication service is not:

* An application backend
* A repository management service
* A synchronization service
* A user platform

The API exists only to support:

* GitHub OAuth authentication
* Authentication validation
* Authentication lifecycle management
* Credential protection

Nothing more.

---

# Base URL

Production:

https://auth.digitaldevgrid.tech

---

Development:

Environment Configured

---

# API Versioning

Current Version:

v1

---

Base Path:

/api/v1

---

# Endpoint Categories

The service exposes only:

* Authentication Endpoints
* Authentication State Endpoints
* Health Endpoints

No product endpoints.

No repository endpoints.

No synchronization endpoints.

---

# Authentication Endpoints

---

## GET /api/v1/auth/login

Purpose:

Initiate GitHub OAuth authentication.

---

### Request

No request body.

---

### Response

Redirect user to GitHub OAuth authorization page.

---

### Called By

DevGrid Extension

---

### Responsibilities

* Generate OAuth state parameter
* Generate authorization request
* Redirect to GitHub OAuth

---

## GET /api/v1/auth/callback

Purpose:

Handle GitHub OAuth callback.

---

### Called By

GitHub OAuth

---

### Inputs

* Authorization Code
* State Parameter

---

### Responsibilities

* Validate state parameter
* Validate request integrity
* Exchange authorization code
* Retrieve authenticated user
* Generate authentication result

---

### Response

Authentication Result is generated upon successful OAuth completion.

The mechanism used to deliver the Authentication Result to DevGrid Extension is intentionally unspecified by this contract.

Requirements:

* Authentication result must be delivered securely
* OAuth Client Secret must never be exposed
* Authentication Service must not become a repository proxy
* Authentication completion must remain compatible with future authentication lifecycle management

Implementation details are defined separately from this API contract.

---

### Notes

Not called directly by the extension.

---

## POST /api/v1/auth/logout

Purpose:

Terminate current authentication state.

---

# POST /api/v1/auth/exchange

Status:

Planned

Purpose:

Exchange a One-Time Authentication Code for an Authentication Result.

Request:

{
"authCode": "generated-authentication-code"
}

Response:

{
"success": true,
"data": {
"user": {
"githubId": 123456,
"username": "octocat"
},
"token": {
"accessToken": "gho_xxx",
"tokenType": "bearer",
"scope": "repo,user"
}
}
}

---

Security Requirements

* Authentication Code must be valid
* Authentication Code must be unexpired
* Authentication Code must be unused
* Authentication Code must be consumed after successful exchange

Invalid or expired codes must be rejected.


### Called By

DevGrid Extension

---

### Responsibilities

* Invalidate authentication state
* Complete logout workflow

---

### Response

Logout Success

---

# Authentication State Endpoints

These endpoints exist solely to support authentication lifecycle management.

They must not evolve into user management endpoints.

---

## GET /api/v1/session/validate

Purpose:

Determine whether current authentication remains valid.

---

### Called By

DevGrid Extension

---

### Response

Authenticated

or

Unauthenticated

---

### Use Cases

* Extension startup
* Popup open
* Manual validation
* Authentication-sensitive operations

---

### Notes

This endpoint validates authentication state.

It is not a general-purpose user session endpoint.

---

## GET /api/v1/session/me

Purpose:

Retrieve authenticated user metadata.

---

### Response

Authentication metadata only.

Examples:

* GitHub Username
* GitHub User ID
* Authentication Status

---

### Notes

Must not expose:

* OAuth Access Tokens
* OAuth Client Secrets
* Internal Credentials
* Sensitive Authentication Data

---

# Health Endpoints

---

## GET /api/v1/health

Purpose:

Service health monitoring.

---

### Response

Service Status

---

### Notes

No authentication required.

No sensitive information returned.

---

# Standard Response Format

## Success Response

```json
{
  "success": true,
  "data": {}
}
```

---

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

---

# Error Codes

## AUTH_REQUIRED

Authentication required.

---

## AUTH_INVALID

Authentication invalid.

---

## AUTH_EXPIRED

Authentication expired.

---

## AUTH_REVOKED

GitHub authorization revoked.

---

## INVALID_REQUEST

Request malformed.

---

## RATE_LIMITED

Too many requests.

---

## SERVER_ERROR

Unexpected failure.

---

# Authentication Requirements

Protected Endpoints:

* /session/validate
* /session/me
* /auth/logout

---

Public Endpoints:

* /auth/login
* /auth/callback
* /health

---

# Ownership Model

Authentication Service Owns:

* Login
* Logout
* OAuth callback handling
* Authentication validation
* Authentication metadata

---

DevGrid Extension Owns:

* Repository selection
* Repository synchronization
* Commit creation
* File updates
* User workflows
* Product functionality
* Direct GitHub API communication

---

# Explicitly Forbidden Endpoints

Do not implement:

---

## Repository Endpoints

Examples:

* Create Repository
* Update Repository
* Delete Repository
* Commit File
* Upload File

---

## Synchronization Endpoints

Examples:

* Sync Repository
* Sync Submission
* Push Changes

---

## Submission Endpoints

Examples:

* Save Submission
* Get Submission
* Update Submission

---

## Statistics Endpoints

Examples:

* User Stats
* Progress Metrics
* Analytics

---

## Product Endpoints

Examples:

* Markdown Generation
* README Generation
* Settings Management

---

These belong exclusively to:

DevGrid Extension

---

# Architectural Rules

Repository Operations:

Extension
↓
GitHub

---

Authentication Operations:

Extension
↓
Authentication Service
↓
GitHub OAuth

---

Incorrect:

Extension
↓
Authentication Service
↓
GitHub

for repository operations.

---

The authentication service exists only to support authentication.

---

# Contract Stability

Endpoints defined here become public contracts.

Changes require:

Documentation
↓
Review
↓
Approval
↓
Implementation

---

# Definition Of Success

A successful API contract:

* Remains minimal
* Remains understandable
* Supports OAuth authentication
* Protects architectural boundaries
* Prevents backend creep
* Keeps repository operations inside DevGrid Extension

The authentication service should remain small, focused, secure, and boring.
