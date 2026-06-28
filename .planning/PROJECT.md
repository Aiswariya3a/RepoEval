# Project Intelligence & Evaluation Platform

## What This Is

An AI-powered platform that automatically analyzes software projects from GitHub repositories and generates comprehensive evaluation reports. It combines static code analysis, repository mining, and AI agents to assess code quality, engineering maturity, documentation, collaboration, contributor performance, and overall project health. Designed for educators, engineering managers, hackathon judges, and open-source maintainers who need objective, rubric-based assessments within minutes instead of manual reviews.

## Core Value

Automatically generate objective, rubric-based evaluation reports for any GitHub repository within minutes — identifying risks, strengths, weaknesses, and actionable recommendations.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] GitHub repository ingestion and analysis
- [ ] Static code analysis (code quality metrics)
- [ ] Repository mining (commit history, PRs, issues)
- [ ] AI agent-based assessment engine
- [ ] Code quality assessment
- [ ] Engineering maturity evaluation
- [ ] Documentation quality analysis
- [ ] Collaboration and contributor performance evaluation
- [ ] Project health assessment
- [ ] Customizable rubric-based evaluation criteria
- [ ] Risk identification and flagging
- [ ] Strengths/weaknesses identification
- [ ] Actionable recommendation generation
- [ ] Comprehensive evaluation report output
- [ ] User management and project dashboard

### Out of Scope

- Real-time repository monitoring — Deferred to post-MVP
- Native CI/CD integration — Deferred to post-MVP
- Multi-repo comparison dashboards — Deferred to v2
- On-premise deployment — SaaS-first, evaluate later
- Mobile app — Web-first

## Context

Built as a web application combining GitHub API integration, static analysis tooling, and LLM-based AI agents. The platform targets multiple user segments: educators evaluating student projects, engineering managers assessing team health, hackathon judges scoring submissions, and maintainers evaluating contributions. The long-term vision extends beyond evaluation into an intelligent AI Engineering Manager capable of understanding, explaining, and advising on software project health and maturity.

## Constraints

- **Tech Stack**: Modern web stack (details to be determined during research)
- **Integration**: Must consume GitHub API (REST/GraphQL)
- **AI Dependency**: Requires LLM integration for AI agent evaluations
- **Performance**: Evaluation should complete within minutes per repository

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM integration approach | Core to AI agent evaluation engine | — Pending |
| Evaluation architecture | Pipeline-based for v1, agentic for v2 | ✓ Decided |
| Frontend framework | Next.js 16 App Router with shadcn/ui | ✓ Decided |
| Backend framework | Python 3.12+ / FastAPI 0.138 | ✓ Decided |
| Database | PostgreSQL 16 + SQLAlchemy async + Alembic | ✓ Decided |
| Auth | GitHub OAuth App + JWT httpOnly cookies | ✓ Decided |
| Theme | Dark indigo (#0F172A bg, #4F46E5 primary), dark mode first | ✓ Decided |
| Design system | shadcn/ui + Inter + JetBrains Mono + custom indigo palette | ✓ Decided |
| Deployment | Railway (backend Docker) + Vercel (frontend Next.js) | ✓ Decided |
| Dev environment | Docker Compose (FastAPI + PostgreSQL + Redis) | ✓ Decided |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-28 after initialization*
