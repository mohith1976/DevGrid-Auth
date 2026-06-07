# DevGrid OAuth Authentication Flow

Version: 2.0

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the complete authentication flow between:

* DevGrid Extension
* DevGrid Authentication Service
* GitHub OAuth

No implementation decisions should contradict this document.

This document serves as the source of truth for authentication behavior.

---

# Authentication Goals

The authentication system must:

* Eliminate Personal Access Tokens
* Minimize onboarding friction
* Preserve user trust
* Remain understandable
* Remain secure
* Provide a familiar Sign In With GitHub experience

---

# System Components

## Component A

DevGrid Extension

Responsibilities:

* Authentication initiation
* Authentication state management
* Repository selection
* User interaction
* Repository synchronization

---

## Component B

DevGrid Authentication Service

Responsibilities:

* OAuth authorization flow
* OAuth callback handling
* Token exchange
* Secret protection
* Session validation

---

## Component C

GitHub OAuth

Responsibilities:

* User authentication
* User authorization
* Access token issuance

---

# High-Level Flow

User
↓
Extension
↓
Authentication Service
↓
GitHub OAuth
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
* Authorization Request

and redirects user to GitHub OAuth.

---

## Step 6

GitHub displays:

Authorize DevGrid

User reviews:

* Application name
* Requested permissions

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

OAuth Access Token

---

## Step 11

Authentication Service returns:

Authentication Result

to DevGrid Extension.

Returned data may include:

* OAuth Access Token
* GitHub Username
* GitHub User ID
* Authentication Metadata

---

## Step 12

Extension stores:

* OAuth Access Token
* Authentication Metadata
* Repository Metadata

inside:

chrome.storage.local

---

## Step 13

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

directly from GitHub.

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

# Repository Synchronization Flow

Repository synchronization does not involve the authentication service.

---

Flow:

Extension
↓
GitHub

---

The authentication service must never proxy repository operations.

---

# Session Validation Flow

Session validation occurs during:

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

* OAuth Access Token
* Authentication Metadata
* Repository Configuration

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

OAuth validation fails.

---

## Result

Extension marks session invalid.

---

## User Experience

Display:

GitHub access has been revoked.

Please sign in again.

---

# Token Expiration Flow

Scenario:

OAuth token expires.

---

## Detection

GitHub API request fails.

or

Session validation fails.

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

## Boundary 1

Extension ↔ Authentication Service

Communication:

HTTPS only

---

## Boundary 2

Authentication Service ↔ GitHub OAuth

Communication:

HTTPS only

---

## Boundary 3

Extension ↔ GitHub

Communication:

HTTPS only

Used for:

* Repository discovery
* Repository synchronization
* Commit creation
* File updates

---

# Security Requirements

Authentication Service must never expose:

* OAuth Client Secret
* Internal credentials

---

Extension must never store:

* OAuth Client Secret
* Authentication Service credentials

---

Extension may store:

* OAuth Access Token
* Authentication Metadata
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

Install Extension
↓
Sign In With GitHub
↓
Select Repository
↓
Use DevGrid

without manually generating Personal Access Tokens.

The authentication experience should feel familiar, simple, and predictable.
