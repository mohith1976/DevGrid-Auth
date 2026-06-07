# DevGrid Authentication Service Constitution

Version: 2.0

Status: ACTIVE

Repository Type: Supporting Repository

---

# Purpose

This repository contains DevGrid authentication infrastructure.

It is not the DevGrid product.

It exists solely to support secure GitHub OAuth authentication.

The authentication service must remain:

* Minimal
* Secure
* Maintainable
* Independently deployable

The authentication service exists to eliminate Personal Access Tokens while providing a familiar Sign In With GitHub experience.

---

# Governance Rules

# Engineering Standards

These standards apply to all DevGrid repositories.

## Core Principle

Write software for the current stage of the product.

Avoid both:

* Under-engineering
* Premature over-engineering

Architecture must be justified by actual requirements.

Do not introduce abstractions, layers, services, interfaces, folders, or patterns solely because they are common in enterprise software.

Every abstraction must have a clear reason to exist.

---

## Simplicity First

Prefer:

* Simple code
* Clear code
* Readable code
* Maintainable code

Over:

* Clever code
* Excessively generic code
* Premature abstraction
* Pattern-driven development

If two solutions solve the same problem:

Choose the simpler one.

---

## Production Readiness

Production-ready does NOT mean:

* More files
* More folders
* More interfaces
* More abstractions

Production-ready means:

* Correctness
* Reliability
* Security
* Maintainability
* Observability
* Testability

---

## Abstraction Rule

Before creating:

* Interface
* Service
* Factory
* Strategy
* Provider
* Module
* Layer

Ask:

1. What problem does this abstraction solve?
2. Is the problem real today?
3. Will removing this abstraction make the code worse?

If the answer is no:

Do not create the abstraction.

---

## File Organization

Prefer cohesive modules.

Avoid extreme fragmentation.

Bad:

auth/
├── user.ts
├── token.ts
├── state.ts
├── result.ts

where every file contains only a few lines.

Also avoid:

auth.ts

containing thousands of unrelated lines.

Aim for balanced organization.

Files should be organized around responsibility, not dogma.

---

## Domain Layer Rules

Domain layer exists to define business contracts.

Domain layer should contain:

* Types
* Interfaces
* Enums
* Business contracts

Domain layer should not contain:

* Infrastructure concerns
* Framework concerns
* HTTP concerns
* Database concerns

Keep domain models small and focused.

---

## Future-Proofing Rule

Design for likely future requirements.

Do not design for imaginary future requirements.

If a requirement does not exist:

Do not build for it.

Leave room for it.

---

## Review Rule

Before approving implementation:

1. Verify correctness
2. Verify maintainability
3. Verify simplicity
4. Verify consistency with repository standards

Do not approve complexity simply because it is technically valid.

The simplest correct solution is preferred.


## Authority Hierarchy

The source of truth for DevGrid is:

1. User Instructions
2. Approved ADR Documents
3. Phase Output Documents
4. instruction.md
5. v2-planning.md

If conflicts exist, higher-priority sources override lower-priority sources.

---

## Specification Authority

Kiro must not create new architecture decisions.

Kiro must not create alternative architectures.

Kiro must not reinterpret approved ADRs.

Kiro must not replace approved designs with its own recommendations.

Architecture has already been decided.

Implementation follows architecture.

---

## Spec Mode Restrictions

When operating in Spec Mode:

Kiro may:

* Clarify requirements
* Break work into tasks
* Create implementation plans
* Create technical designs that comply with approved ADRs

Kiro may not:

* Change repository ownership
* Change authentication architecture
* Change communication models
* Change security models
* Change deployment models
* Introduce new infrastructure
* Create replacement specifications

without explicit user approval.

---

## Architecture Freeze

Phase 1, Phase 2, and Phase 3 are complete.

Architecture is frozen.

The following decisions are locked:

* Two repository architecture
* GitHub OAuth authentication
* Minimal authentication service
* Repository boundaries
* Permission model
* Credential storage strategy
* Credential lifecycle strategy
* Onboarding strategy

These decisions must be treated as requirements, not suggestions.

---

## No Autonomous Expansion

Kiro must not independently introduce:

* Databases
* Analytics systems
* Queues
* Event buses
* Additional services
* Additional repositories
* Telemetry systems
* Monitoring platforms
* New infrastructure

unless explicitly approved through a new ADR.

---

## Documentation Discipline

New documents may only be created when:

* Requested by the user
* Required by an approved roadmap phase
* Required by implementation

Do not generate speculative specifications.

Do not generate future-roadmap documents.

Do not create recommended architecture documents.

Architecture decisions already exist.

---

## Authentication Service Protection Rule

The authentication service exists solely to support authentication.

Kiro must not transform devgrid-auth into:

* An application backend
* A repository synchronization service
* A user management platform
* An analytics platform
* A data processing service

If functionality can live in devgrid-extension, it belongs in devgrid-extension.

---

# Mission

Provide secure authentication for DevGrid.

Nothing more.

This repository exists because OAuth client credentials cannot safely exist inside a public browser extension.

The service owns OAuth authorization and token exchange while keeping the user experience simple.

---

# Authentication Strategy

DevGrid uses GitHub OAuth.

GitHub OAuth was selected because:

* Users already understand Sign In With GitHub
* It minimizes onboarding friction
* It removes Personal Access Tokens
* It provides sufficient security for DevGrid's use case
* It aligns with DevGrid's goal of adoption and simplicity

GitHub Apps were evaluated and rejected due to the additional installation complexity introduced into the user onboarding flow.

---

# Repository Ownership

This repository owns:

## GitHub OAuth Integration

* OAuth configuration
* OAuth communication
* Authorization flow
* OAuth state validation
* Authorization code exchange
* Authenticated user retrieval

Repository operations remain outside this repository.

---

## Authentication

* Login
* Logout
* Authentication validation
* Authorization callbacks
* Authentication state verification

The authentication service is responsible for OAuth authentication workflows.

The authentication service is not responsible for product workflows.

## Credential Management

* OAuth client credentials
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

Repository Operations

Extension
↓
Auth Service
↓
GitHub

Correct:

Repository Operations

Extension
↓
GitHub

Authentication Operations

Extension
↓
Auth Service
↓
GitHub OAuth

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

## Principle 5A - Build For Current Complexity

Implement the complexity that exists today.

Do not introduce abstractions for hypothetical future requirements.

Avoid:

* Premature abstraction
* Premature scalability
* Premature infrastructure

Leave room for future growth without implementing future systems.

The simplest correct solution is preferred.

## Principle 5B - Engineering Over Pattern Collection

Code quality is measured by:

* Correctness
* Reliability
* Maintainability
* Security

Code quality is not measured by:

* Number of layers
* Number of interfaces
* Number of files
* Number of abstractions

Patterns exist to solve problems.

Do not introduce patterns that do not solve a real problem.



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

# Intended Architecture

src/

├── routes/
├── services/
├── middleware/
├── domain/
├── config/
└── utils/

This structure represents architectural responsibilities.

Folder structure should remain pragmatic.

Do not introduce additional layers without justification.

Do not create abstractions solely to mirror enterprise architectures.
---
# Implementation Philosophy

Implementation should prioritize:

1. Correctness
2. Simplicity
3. Maintainability
4. Security

When multiple valid solutions exist:

Choose the simplest solution that satisfies requirements.

Do not create architecture for architecture's sake.

Do not create abstractions before they become necessary.

Production-ready software is not measured by complexity.

Production-ready software is measured by reliability.

---
# Definition Of Success

A successful authentication service:

* Provides Sign In With GitHub
* Eliminates Personal Access Tokens
* Requires minimal maintenance
* Remains independently deployable
* Never becomes a product backend
* Never becomes a synchronization service
* Never becomes a data platform

Users should be able to:

Install Extension
↓
Sign In With GitHub
↓
Select Repository
↓
Use DevGrid

without manually generating credentials.
