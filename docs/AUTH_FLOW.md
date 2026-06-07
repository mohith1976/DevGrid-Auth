# DevGrid Authentication Flow

Version: 1.0

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the complete authentication flow between:

* DevGrid Extension
* DevGrid Authentication Service
* GitHub

No implementation decisions should contradict this document.

This document serves as the source of truth for authentication behavior.

---

# Authentication Goals

The authentication system must:

* Eliminate Personal Access Tokens
* Minimize onboarding friction
* Preserve least-privilege access
* Protect GitHub App secrets
* Maintain user trust
* Remain understandable
* Remain secure

---

# System Components

## Component A

DevGrid Extension

Responsibilities:

* Authentication initiation
* Authentication state management
* Session validation
* Repository selection
* User interaction

---

## Component B

DevGrid Authentication Service

Responsibilities:

* GitHub App integration
* Authorization flow
* Token exchange
* Secret protection
* Session validation

---

## Component C

GitHub

Responsibilities:

* User authentication
* User authorization
* Repository authorization
* Access token issuance

---

# High-Level Flow

User
↓
Extension
↓
Authentication Service
↓
GitHub
↓
Authentication Service
↓
Extension
↓
Authenticated

---

# Login Flow

## Step 1

User opens DevGrid.

Extension checks:

Authentication Status

---

## Step 2

If user is not authenticated:

Display:

Sign In With GitHub

---

## Step 3

User clicks:

Sign In With GitHub

---

## Step 4

Extension requests authentication initiation from:

auth.digitaldevgrid.tech

---

## Step 5

Authentication Service generates:

* State Parameter
* Request Metadata

and redirects user to GitHub authorization.

---

## Step 6

GitHub displays:

Authorize DevGrid

User reviews:

* Application name
* Permissions requested
* Repository scope

---

## Step 7

User approves authorization.

---

## Step 8

GitHub redirects user back to:

Authentication Service

with:

* Authorization Code
* State Parameter

---

## Step 9

Authentication Service validates:

* State
* Request integrity

---

## Step 10

Authentication Service exchanges:

Authorization Code

for:

GitHub Access Credentials

---

## Step 11

Authentication Service creates:

Authenticated Session

---

## Step 12

Authentication Service returns:

Authentication Result

to DevGrid Extension.

---

## Step 13

Extension stores:

* Authentication State
* Session Metadata
* Repository Metadata

inside:

chrome.storage.local

---

## Step 14

Extension enters:

Authenticated State

---

# Repository Selection Flow

Authentication and repository selection are separate concerns.

---

## Step 1

Authentication succeeds.

---

## Step 2

Extension requests:

Available Repositories

from GitHub.

---

## Step 3

User selects repository.

---

## Step 4

Selected repository becomes:

Active DevGrid Repository

---

## Step 5

Repository configuration stored locally.

---

# Session Validation Flow

Session validation occurs:

* Extension startup
* Popup open
* Manual refresh
* Authentication-sensitive operations

---

## Validation Process

Extension
↓
Authentication Service
↓
Session Check
↓
Valid / Invalid

---

## Valid

Continue normally.

---

## Invalid

Require re-authentication.

---

# Logout Flow

## Step 1

User selects:

Logout

---

## Step 2

Extension removes:

* Session metadata
* Repository configuration
* Authentication state

---

## Step 3

Authentication Service invalidates session.

---

## Step 4

Extension returns to:

Unauthenticated State

---

# Revocation Flow

Scenario:

User revokes DevGrid access through GitHub.

---

## Detection

Session validation fails.

---

## Result

Extension marks session invalid.

---

## User Experience

Display:

GitHub access has been revoked.
Please sign in again.

---

# Expiration Flow

Scenario:

Authentication credentials expire.

---

## Detection

Validation fails.

---

## Result

Require re-authentication.

---

## User Experience

Display:

Your session has expired.
Please sign in again.

---

# Failure Handling

## GitHub Unavailable

Display:

GitHub is currently unavailable.
Please try again later.

---

## Authentication Service Unavailable

Display:

Authentication service is unavailable.
Please try again later.

---

## Invalid Authorization Response

Display:

Authentication failed.
Please try again.

---

## Network Failure

Display:

Network error.
Please check your connection.

---

# Trust Boundaries

Boundary 1

Extension ↔ Authentication Service

Communication:

HTTPS only

---

Boundary 2

Authentication Service ↔ GitHub

Communication:

HTTPS only

---

Boundary 3

Extension ↔ GitHub

Communication:

HTTPS only

Used for repository synchronization.

---

# Security Requirements

Authentication Service must never expose:

* GitHub App Private Keys
* Client Secrets

---

Extension must never store:

* GitHub App Private Keys
* Client Secrets

---

Extension may store:

* Authentication State
* Session Metadata
* Repository Configuration

---

# Architectural Rules

Authentication Service:

Handles Authentication

---

Extension:

Handles Product Functionality

---

Repository Synchronization:

Extension
↓
GitHub

NOT

Extension
↓
Authentication Service
↓
GitHub

---

# Definition Of Success

A successful authentication flow allows a user to:

Clone Repository
↓
Build Extension
↓
Load Unpacked
↓
Sign In With GitHub
↓
Select Repository
↓
Use DevGrid

without manually generating Personal Access Tokens.
