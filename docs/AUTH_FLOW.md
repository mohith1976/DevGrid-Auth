# DevGrid OAuth Authentication Flow

Version: 2.1

Status: DESIGN APPROVED

Repository: DevGrid-Auth

---

# Purpose

This document defines the complete authentication flow between:

* DevGrid Extension
* DevGrid Authentication Service
* GitHub OAuth

This document is the source of truth for authentication behavior.

No implementation should contradict the flow defined here.

---

# Authentication Goals

The authentication system must:

* Eliminate Personal Access Tokens
* Minimize onboarding friction
* Preserve user trust
* Remain secure
* Remain understandable
* Provide a familiar Sign In With GitHub experience

Users should be able to:

Install Extension
↓
Sign In With GitHub
↓
Select Repository
↓
Use DevGrid

without manually generating credentials.

---

# System Components

## Component A

DevGrid Extension

Responsibilities:

* Authentication initiation
* Authentication state management
* User interaction
* Repository selection
* Repository synchronization
* GitHub repository operations

---

## Component B

DevGrid Authentication Service

Responsibilities:

* OAuth authorization flow
* OAuth callback handling
* OAuth code exchange
* Secret protection
* Authentication validation

The authentication service exists solely to support authentication.

---

## Component C

GitHub OAuth

Responsibilities:

* User authentication
* User authorization
* OAuth access token issuance

---

# High-Level Authentication Flow

User
↓
DevGrid Extension
↓
Authentication Service
↓
GitHub OAuth
↓
Authentication Service
↓
DevGrid Extension
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

Extension initiates authentication through:

auth.digitaldevgrid.tech

---

## Step 5

Authentication Service generates:

* OAuth State Parameter
* Authorization Request

and redirects user to GitHub OAuth.

---

## Step 6

GitHub displays:

Authorize DevGrid

User reviews:

* Application Name
* Requested Permissions

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

* OAuth State
* Request Integrity

---

## Step 10

Authentication Service exchanges:

Authorization Code

for:

OAuth Access Token

---

## Step 11

Authentication Service retrieves:

Authenticated GitHub User

---

## Step 12

Authentication Service completes:

OAuth Authentication

and produces:

Authentication Result

Authentication Result may contain:

* OAuth Access Token
* GitHub User ID
* GitHub Username
* Authentication Metadata

---

## Step 13

Authentication Service securely transfers the Authentication Result to DevGrid Extension.

The transport mechanism is intentionally implementation-specific and must satisfy the following requirements:

* OAuth Client Secret never leaves Authentication Service
* Extension receives authentication result
* Authentication Service does not become a GitHub repository proxy
* Repository operations remain Extension → GitHub
* Authentication completion remains compatible with future authentication lifecycle management

---

## Step 14

Extension stores:

* OAuth Access Token
* Authentication Metadata
* Repository Metadata

inside:

chrome.storage.local

---

## Step 15

Extension enters:

Authenticated State

---

# Repository Selection Flow

Authentication and repository selection are separate concerns.

Authentication success does not automatically select a repository.

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

Repository configuration is stored locally.

---

# Repository Operations Flow

Repository operations are not handled by the authentication service.

Flow:

DevGrid Extension
↓
GitHub

---

Examples:

* Repository Discovery
* Commit Creation
* File Updates
* Repository Synchronization

---

The authentication service must never proxy repository operations.

---

# Authentication Validation Flow

Authentication validation may occur during:

* Extension startup
* Popup open
* Manual refresh
* Authentication-sensitive operations

---

## Validation Process

Extension
↓
Authentication Validation
↓
Authenticated

or

Unauthenticated

---

Authentication validation may use:

* Stored authentication metadata
* Authentication service validation
* GitHub authorization status

---

## Authenticated

Continue normally.

---

## Unauthenticated

Require user sign-in.

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

Authentication Service invalidates active authentication state if applicable.

---

## Step 4

Extension returns to:

Unauthenticated State

---

# Authorization Revocation Flow

Scenario:

User revokes DevGrid authorization through GitHub.

---

## Detection

GitHub authorization validation fails.

---

## Result

Extension marks authentication invalid.

---

## User Experience

Display:

GitHub access has been revoked.

Please sign in again.

---

# Authentication Expiration Flow

Scenario:

Authentication becomes invalid.

Examples:

* OAuth token expiration
* Authorization revocation
* Invalid authentication state

---

## Detection

GitHub API request fails.

or

Authentication validation fails.

---

## Result

Require user sign-in.

---

## User Experience

Display:

Authentication expired.

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

# Authentication Completion Requirements

Authentication completion occurs after successful OAuth callback processing.

Requirements:

* Extension must receive authentication result
* Authentication Service must retain ownership of OAuth Client Secret
* Repository operations must continue to occur directly between Extension and GitHub
* Authentication Service must not become a repository proxy
* Authentication completion must support future authentication lifecycle management
* Authentication completion must not require users to manually copy credentials

The specific transport mechanism is an implementation decision and is intentionally not defined by this document.

# Authentication Completion Flow

After successful OAuth callback processing, Authentication Service must securely deliver the Authentication Result to DevGrid Extension.

Authentication completion follows the sequence below:

Extension
↓
Initiates OAuth Login

GitHub
↓
User Authorization

Authentication Service
↓
OAuth Callback Processing

Authentication Service
↓
Generate One-Time Authentication Code

Authentication Service
↓
Store Authentication Result Temporarily

Authentication Service
↓
Redirect User Agent To Extension

Extension
↓
Receive One-Time Authentication Code

Extension
↓
Exchange Authentication Code

Authentication Service
↓
Return Authentication Result

Extension
↓
Store Authentication Result

Authentication Result includes:

* OAuth Access Token
* GitHub User Metadata
* Authentication Metadata

---

# Authentication Code Requirements

Authentication Codes must:

* Be cryptographically secure
* Be single-use
* Expire automatically
* Be invalid after successful exchange
* Never be reused

Authentication Codes are temporary transport credentials only.

They are not authentication sessions.

They are not refresh tokens.

They are not long-term credentials.


# Trust Boundaries

## Boundary 1

Extension ↔ Authentication Service

Requirements:

* HTTPS Only

---

## Boundary 2

Authentication Service ↔ GitHub OAuth

Requirements:

* HTTPS Only
* Verified GitHub Responses

---

## Boundary 3

Extension ↔ GitHub

Requirements:

* HTTPS Only

Used For:

* Repository Discovery
* Repository Synchronization
* Commit Creation
* File Updates

---

# Security Requirements

Authentication Service must never expose:

* OAuth Client Secret
* Internal Credentials

---

Extension must never store:

* OAuth Client Secret
* Authentication Service Secrets

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

The authentication service must never become a GitHub repository proxy.

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

with minimal onboarding friction.

The authentication experience should feel simple, familiar, secure, and predictable.
