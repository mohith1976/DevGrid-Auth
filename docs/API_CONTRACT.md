# DevGrid Authentication API Contract

Version: 1.0

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

Initiate GitHub authentication.

---

### Request

No request body.

---

### Response

Redirect user to GitHub authorization flow.

---

### Called By

DevGrid Extension

---

### Notes

Authentication service generates:

* State parameter
* Authorization request

---

## GET /api/v1/auth/callback

Purpose:

Handle GitHub authorization callback.

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
* Create authenticated session

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

Must not expose credentials.

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

Success Responses

{
"success": true,
"data": {}
}

---

Error Responses

{
"success": false,
"error": {
"code": "",
"message": ""
}
}

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

# Explicitly Forbidden Endpoints

Do not implement:

Repository Endpoints

Examples:

* create repository
* update repository
* commit file
* upload file

---

Submission Endpoints

Examples:

* save submission
* get submission
* sync submission

---

Statistics Endpoints

Examples:

* user stats
* progress metrics
* analytics

---

Product Endpoints

Examples:

* markdown generation
* README generation
* settings management

These belong to:

DevGrid-Extension

---

# Ownership Model

Authentication Service Owns:

* Login
* Logout
* Session Validation
* Session Metadata

---

Extension Owns:

* Repository Operations
* Submission Operations
* Markdown Operations
* User Workflows

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
* Supports authentication
* Protects boundaries
* Prevents backend creep
