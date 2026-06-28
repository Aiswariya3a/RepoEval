# Phase 1: Foundation & Authentication - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely access the platform via GitHub OAuth, and the foundational project architecture (monorepo, database, dev environment, deployment infra) is in place. This phase delivers: GitHub OAuth sign-in, session management, project scaffolding (backend + frontend), initial database schema, Docker Compose dev environment, and Railway/Vercel deployment setup.

</domain>

<decisions>
## Implementation Decisions

### Monorepo Structure
- **D-01:** Standard backend/frontend monorepo — `/backend` (Python/FastAPI), `/frontend` (Next.js 16), shared tooling configs at root (`docker-compose.yml`, `.github/`, `.gitignore`)
- **D-02:** No turborepo or nx — simpler root-level scripts (Makefile / npm scripts) sufficient for v1

### Authentication Provider
- **D-03:** GitHub OAuth App (server-side web application flow) as the sole sign-in provider for v1
- **D-04:** No Auth0 or third-party auth service — direct GitHub OAuth integration keeps auth simple and prepares for the platform's own GitHub-centric features
- **D-05:** OAuth callback URL served by FastAPI backend, not frontend (simplifies token handling)

### Database Schema & Migration
- **D-06:** SQLAlchemy 2.0 async (`asyncpg`) with Alembic for migrations — research-recommended, Pydantic v2 compatible
- **D-07:** Initial tables: `users` (GitHub ID, email, display name, avatar URL), `sessions` (refresh token, user FK, expiry), `projects` (name, description, owner FK, created_at)
- **D-08:** PostgreSQL 16 with `uuid-ossp` extension for UUID primary keys

### Session & Token Management
- **D-09:** JWT access tokens stored in httpOnly cookies (not localStorage) — XSS-safe
- **D-10:** Access token expiry: 15 minutes; refresh token: 7 days with rotation
- **D-11:** Token signing with RS256 using a key pair generated at deploy time
- **D-12:** CSRF protection via SameSite=Strict cookie attribute + state parameter in OAuth flow

### Dev Environment
- **D-13:** Docker Compose with services: FastAPI dev server (hot-reload), PostgreSQL 16, Redis 7
- **D-14:** Makefile targets: `make dev` (start all services), `make migrate` (run Alembic), `make test`
- **D-15:** No production-like dev needed — Railway handles production infra

### Deployment
- **D-16:** Railway for backend (Docker-based FastAPI deployment with PostgreSQL + Redis add-ons)
- **D-17:** Vercel for frontend (Next.js 16 native deployment, zero-config)
- **D-18:** GitHub Actions CI: lint on PR, test on PR, deploy on merge to main

### OpenCode's Discretion
- Exact cookie configuration details (path, domain, secure flag)
- Frontend auth library choice (next-auth vs custom)
- Dockerfile optimization details
- CI pipeline exact step configuration

</decisions>

<specifics>
## Specific Ideas

- Authentication flow should feel seamless — user clicks "Sign in with GitHub" and is redirected back to the app without manual token handling
- The platform is GitHub-centric, so GitHub OAuth is the natural auth mechanism — also provides the API token for repo operations later
- Dev environment must "just work" with a single `docker compose up` command
- No email/password auth for v1 — simplifies security surface and aligns with GitHub-native positioning

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project vision, core value, and requirements
- `.planning/REQUIREMENTS.md` §AUTH-01 — Requirement for GitHub OAuth sign-in
- `.planning/ROADMAP.md` §Phase 1 — Phase goal, success criteria, requirement mapping

### Research & Stack Decisions
- `.planning/research/STACK.md` §Core Technologies — FastAPI 0.138, Next.js 16, PostgreSQL 16, Redis 7 recommendations
- `.planning/research/STACK.md` §Deployment — Railway + Vercel recommendations with rationale
- `.planning/research/ARCHITECTURE.md` §Architecture Patterns — Multi-stage pipeline architecture, project structure patterns
- `.planning/research/FEATURES.md` §MVP Definition — Authentication as table-stakes feature
- `.planning/research/PITFALLS.md` — GitHub API rate limiting pitfalls (relevant for OAuth token strategy)

### No External Specs
No external specification documents exist — requirements are fully captured in the decisions above and the referenced planning documents.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing codebase

### Established Patterns
- None — this phase establishes the foundational patterns (monorepo structure, testing conventions, code organization) that all subsequent phases will follow

### Integration Points
- GitHub OAuth API — backend calls GitHub's `https://github.com/login/oauth/access_token` and `https://api.github.com/user`
- Railway — backend Docker deployment; PostgreSQL and Redis add-on provisioning
- Vercel — frontend Next.js deployment; environment variable configuration for API URL

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-06-28*
