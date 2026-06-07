# DevGrid Authentication Service Constitution

Version: 1.0

Status: ACTIVE

Repository Type: Supporting Repository

---

# Purpose

This repository contains DevGrid authentication infrastructure.

It is not the DevGrid product.

It exists solely to support secure GitHub App authentication.

The authentication service must remain:

* Minimal
* Secure
* Maintainable
* Independently deployable

---

# Mission

Provide secure authentication for DevGrid.

Nothing more.

This repository exists because GitHub App secrets cannot safely exist inside a public browser extension.

---

# Repository Ownership

This repository owns:

## GitHub App Integration

* GitHub App configuration
* GitHub App communication
* GitHub App authorization flow

---

## Authentication

* Login
* Logout
* Session validation
* Authorization callbacks
* Authentication state verification

---

## Credential Management

* GitHub App private keys
* Client secrets
* Secret rotation
* Credential protection

---

## Security Controls

* Request validation
* Authentication validation
* Abuse prevention
* Rate limiting

---

# Repository Boundaries

This repository DOES NOT own:

* Submission processing
* Repository synchronization
* Markdown generation
* Statistics generation
* User workflows
* Product features
* LeetCode integration
* Repository content

Those belong exclusively to:

devgrid-extension

---

# Architectural Role

This repository is:

Authentication Infrastructure

It is NOT:

Application Backend

---

# Multi Repository Architecture

Repository A

devgrid-extension

Public

Master Repository

---

Repository B

devgrid-auth

Private

Supporting Repository

---

This repository serves the extension.

The extension does not serve this repository.

Architecture decisions originate from the master repository.

---

# Core Architectural Principles

## Principle 1 - Authentication Only

Every feature added to this repository must directly support authentication.

If a feature does not support authentication:

It does not belong here.

---

## Principle 2 - No Product Logic

Product logic is forbidden.

Examples:

* Submission processing
* Markdown generation
* Statistics generation
* Sync orchestration

must never exist in this repository.

---

## Principle 3 - No GitHub Proxy

Incorrect:

Extension
↓
Auth Service
↓
GitHub

Correct:

Extension
↓
GitHub

The authentication service must never become a repository proxy.

---

## Principle 4 - Secret Ownership

All authentication secrets belong here.

Secrets must never exist inside:

* Browser extensions
* Public repositories
* Client-side code

---

## Principle 5 - Infrastructure Minimalism

Keep the service as small as possible.

Complexity requires justification.

---

## Principle 6 - Security Before Convenience

When security and convenience conflict:

Security wins.

---

## Principle 7 - Independent Deployability

This repository must be deployable independently.

No source-code dependency on devgrid-extension.

Communication occurs only through HTTP APIs.

---

## Principle 8 - API Contract First

Changes to public endpoints require:

Documentation
↓
Review
↓
Implementation

Endpoints are contracts.

---

# Intended Architecture

src/

├── routes/
│
├── services/
│   ├── auth/
│   ├── github-app/
│   └── token/
│
├── middleware/
│
├── domain/
│
├── config/
│
└── utils/

No additional top-level architecture should be introduced without review.

---

# Layer Responsibilities

## routes/

Responsibilities:

* HTTP endpoints
* Request validation
* Response formatting

Routes coordinate.

Routes do not contain business logic.

---

## services/auth/

Responsibilities:

* Login workflows
* Logout workflows
* Authentication validation
* Session workflows

Core authentication logic belongs here.

---

## services/github-app/

Responsibilities:

* GitHub App integration
* Authorization workflows
* GitHub authentication communication

All GitHub App interactions belong here.

---

## services/token/

Responsibilities:

* Token exchange
* Token lifecycle
* Revocation handling
* Expiration handling

Token management belongs here.

---

## middleware/

Responsibilities:

* Security validation
* Rate limiting
* Request verification
* Abuse prevention

Cross-cutting concerns belong here.

---

## domain/

Responsibilities:

* Authentication contracts
* Shared models
* Auth entities

Examples:

* AuthSession
* TokenExchange
* AuthResult

---

## config/

Responsibilities:

* Environment configuration
* Secret configuration
* Runtime configuration

Secrets must be accessed only through config.

---

## utils/

Pure helper functions only.

No authentication workflows.

No business logic.

---

# Communication Model

The extension communicates with this repository exclusively through HTTPS endpoints.

No shared source code.

No direct imports.

No repository coupling.

---

# Allowed Endpoints

Examples:

* Login
* Logout
* Callback
* Session Validation
* Token Exchange

Authentication endpoints only.

---

# Forbidden Features

Do not introduce:

* User databases
* Analytics platforms
* Telemetry
* Statistics systems
* Queue systems
* Repository storage
* Submission storage
* Markdown generation
* GitHub synchronization
* Processing pipelines

These violate repository boundaries.

---

# Operational Philosophy

The best authentication service is boring.

It should:

* Rarely change
* Be easy to audit
* Be easy to understand
* Be easy to secure

Avoid cleverness.

Prefer simplicity.

---

# Definition Of Success

A successful authentication service:

* Protects secrets
* Enables secure authentication
* Requires minimal maintenance
* Remains independently deployable
* Never becomes a product backend
* Never becomes a synchronization service
* Never becomes a data platform
