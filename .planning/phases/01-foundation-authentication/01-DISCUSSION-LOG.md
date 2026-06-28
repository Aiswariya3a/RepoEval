# Phase 1: Foundation & Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 01-foundation-authentication
**Areas discussed:** Monorepo structure, Authentication provider, Database schema & migration, Session & token management, Dev environment, Deployment

---

## Auto Mode Summary

All decisions were auto-resolved using recommended defaults from research. No interactive discussion occurred.

### Monorepo Structure
| Option | Description | Selected |
|--------|-------------|----------|
| Standard backend/frontend monorepo | FastAPI backend + Next.js frontend with shared root configs | ✓ |
| Separate repos | Backend and frontend in isolated repositories | |
| Turborepo/Nx monorepo | Full monorepo toolchain with build caching | |

**Selection:** Standard backend/frontend monorepo (research recommended)

### Authentication Provider
| Option | Description | Selected |
|--------|-------------|----------|
| GitHub OAuth App + JWT | Direct GitHub OAuth with server-side JWT session tokens | ✓ |
| GitHub OAuth + Auth0 | Auth0 as identity broker with GitHub as one provider | |
| GitHub OAuth + session cookies | Server-side session store instead of JWT | |

**Selection:** GitHub OAuth App + JWT (research recommended)

### Database Schema & Migration
| Option | Description | Selected |
|--------|-------------|----------|
| SQLAlchemy async + Alembic | Async-native ORM with migration tooling | ✓ |
| Prisma (Python) | Type-safe database client | |
| Raw SQL/asyncpg | Direct database access without ORM | |

**Selection:** SQLAlchemy async + Alembic (research recommended)

### Session & Token Management
| Option | Description | Selected |
|--------|-------------|----------|
| JWT httpOnly cookies | XSS-safe JWT with 15-min access + 7-day refresh rotation | ✓ |
| Server-side sessions | Redis-backed session store | |
| localStorage JWT | Client-side JWT storage | |

**Selection:** JWT httpOnly cookies (security best practice)

### Dev Environment
| Option | Description | Selected |
|--------|-------------|----------|
| Docker Compose | Containers for FastAPI + PostgreSQL + Redis | ✓ |
| Native tooling | Direct poetry/pip + local postgres/redis | |
| Devcontainer | VS Code devcontainer for reproducible env | |

**Selection:** Docker Compose (research recommended)

### Deployment
| Option | Description | Selected |
|--------|-------------|----------|
| Railway backend + Vercel frontend | Platform-optimized split deployment | ✓ |
| All-in-one Railway | Backend and frontend on Railway | |
| All-in-one Vercel | Backend and frontend on Vercel | |

**Selection:** Railway backend + Vercel frontend (research recommended)

---

## OpenCode's Discretion

- Exact cookie configuration details (path, domain, secure flag)
- Frontend auth library choice (next-auth vs custom)
- Dockerfile optimization details
- CI pipeline exact step configuration

## Deferred Ideas

None — discussion stayed within phase scope
