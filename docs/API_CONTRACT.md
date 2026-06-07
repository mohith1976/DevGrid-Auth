# DevGrid Authentication API Contract

Version: 2.0

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the public API contract exposed by DevGrid Authentication Service.

All communication between:

DevGrid-Extension
↓
DevGrid-Auth

must occur through endpoints defined here.

Endpoints not defined in this document must not be implemented without architectural review.

---

# API Philosophy

The authentication service is not an application backend.

The API exists solely to support:

* Authentication
* Session validation
* OAuth token exchange
* Credential lifecycle management

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
* Session Endpoints
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

* Generate state parameter
* Generate OAuth authorization request
* Redirect to GitHub

---

## GET /api/v1/auth/callback

Purpose:

Handle GitHub OAuth callback.

---

### Called By

GitHub

---

### Inputs

Authorization Code

State Parameter

---

### Responsibilities

* Validate state
* Validate request integrity
* Exchange authorization code
* Retrieve user information
* Create authentication session

---

### Notes

Not called directly by extension.

---

## POST /api/v1/auth/logout

Purpose:

Terminate authenticated session.

---

### Called By

DevGrid Extension

---

### Responsibilities

* Invalidate session
* Remove active authentication state

---

### Response

Logout Success

---

# Session Endpoints

---

## GET /api/v1/session/validate

Purpose:

Determine session validity.

---

### Called By

DevGrid Extension

---

### Response

Valid

or

Invalid

---

### Use Cases

* Extension startup
* Popup open
* Manual validation
* Sensitive operations

---

## GET /api/v1/session/me

Purpose:

Retrieve authenticated user metadata.

---

### Response

Authentication metadata only.

Examples:

* GitHub username
* GitHub user id
* Session status

---

### Notes

Must not expose secrets.

Must not expose OAuth credentials.

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

AUTH_REQUIRED

Authentication required.

---

AUTH_INVALID

Authentication invalid.

---

AUTH_EXPIRED

Authentication expired.

---

AUTH_REVOKED

GitHub authorization revoked.

---

INVALID_REQUEST

Request malformed.

---

RATE_LIMITED

Too many requests.

---

SERVER_ERROR

Unexpected failure.

---

# Authentication Requirements

Protected Endpoints:

* session/validate
* session/me
* logout

---

Public Endpoints:

* auth/login
* auth/callback
* health

---

# Ownership Model

Authentication Service Owns:

* Login
* Logout
* OAuth callback handling
* Session validation
* Session metadata

---

Extension Owns:

* Repository operations
* Repository selection
* Submission operations
* Markdown operations
* User workflows
* GitHub API interactions

---

# Explicitly Forbidden Endpoints

Do not implement:

---

## Repository Endpoints

Examples:

* create repository
* update repository
* delete repository
* commit file
* upload file

---

## Synchronization Endpoints

Examples:

* sync repository
* sync submission
* push changes

---

## Submission Endpoints

Examples:

* save submission
* get submission
* update submission

---

## Statistics Endpoints

Examples:

* user stats
* progress metrics
* analytics

---

## Product Endpoints

Examples:

* markdown generation
* README generation
* settings management

These belong exclusively to:

DevGrid-Extension

---

# Architectural Rules

Correct:

Extension
↓
GitHub

---

Incorrect:

Extension
↓
Authentication Service
↓
GitHub

for repository operations.

---

Authentication Service exists only to support authentication.

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
* Keeps repository operations inside DevGrid-Extension

The authentication service should remain small, focused, and boring.
