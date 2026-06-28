# Stack Research

**Domain:** AI-powered Project Intelligence & Evaluation Platform
**Researched:** 2026-06-28
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Python** | 3.12+ | Primary runtime | Dominant ecosystem for AI/LLM frameworks (Pydantic AI, LangChain), static analysis tools (radon, bandit, ruff), and data processing. All target frameworks ship Python-first 6-12 months ahead of Node equivalents [1, 2]. |
| **FastAPI** | 0.138.x | Backend API framework | Async-native, automatic OpenAPI docs from type hints, Pydantic v2 validation, dependency injection. Best-in-class Python framework for AI/ML API backends in 2026 [3]. Handles 1,000-3,000 RPS for typical AI workloads. |
| **Next.js** | 16.x (App Router) | Web frontend & dashboard | Largest SaaS ecosystem, React Server Components reduce client bundle for data-heavy report pages, Server Actions eliminate tRPC/REST boilerplate for mutations, Vercel AI SDK for streaming. The default choice for SaaS frontends in 2026 [4, 5]. |
| **React** | 19.x | UI library | shadcn/ui ecosystem, Recharts for evaluation charts, largest hiring pool. Server Components keep report data on the server. |
| **PostgreSQL** | 16+ | Primary database | All data fits relational model: users, projects, repos, evaluations, reports. pgvector extension available if embeddings needed later. ACID compliance for critical evaluation results [6]. |
| **Redis** | 7.x | Cache & message broker | Celery backend/broker, session caching, LLM response deduplication, rate limiting counters, SSE pub/sub for job progress. Sub-millisecond ops [7]. |

### AI & LLM Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Pydantic AI** | 2.0.0+ | LLM agent framework | Type-safe structured outputs from LLMs (validated at compile time via Pydantic schemas), built-in dependency injection for testability, native async streaming, FastAPI integration, retry on validation failure. The 2026 production default for AI agents that return structured data [8, 9]. |
| **LangGraph** | 0.4+ | Complex agent workflows | State-graph architecture with checkpointing, human-in-the-loop, and branching. Used by Klarna (85M users), Uber, LinkedIn, Replit in production. Reach for this when evaluation workflows need conditional routing, multi-agent coordination, or durable execution [10, 11]. |
| **Anthropic Claude API** | Claude Opus 4.5 / Sonnet 4 | LLM provider | Best-in-class for code understanding, structured output, and long-context analysis (200K tokens). Claude excels at code evaluation tasks — can reason about code quality, engineering maturity, and documentation from repository context [12]. |
| **OpenAI API** | GPT-5 / GPT-4o | Secondary LLM provider | Fallback provider for multi-model evaluation strategies (compare results across models for rubric calibration). |

### GitHub API Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **githubkit** | 0.15.x | GitHub API client | Modern, all-batteries-included Python SDK. Both sync **and async** calls, fully typed with Pydantic validation, built-in HTTP caching with Hishel, auto-retry, REST + GraphQL support. Stays up-to-date with GitHub's OpenAPI schema automatically [13]. |
| **PyGithub** | 2.9.x | GitHub API fallback | Mature (7.7K stars, 2012-2026), stable API, LGPL-licensed. Use when githubkit's schema auto-generation introduces breaking changes (a known caveat). Both can coexist [14]. |

### Static Code Analysis Toolkit

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **ruff** | 0.9+ | Python linter (programmatic) | Fastest Python linter (10-100x faster than pylint/flake8), written in Rust. Callable programmatically via `ruff.check()` or subprocess. Replaces isort, flake8, pycodestyle, autoflake — unified ruleset [15]. |
| **radon** | 6.0+ | Code complexity metrics | Cyclomatic complexity (McCabe), Halstead metrics, Maintainability Index (MI), raw SLOC/LOC. Programmatic API — call directly from Python without subprocess. Used by CodeClimate, Codacy, CodeFactor [16]. |
| **bandit** | 1.7+ | Security vulnerability scanner | AST-based security analysis for Python. Finds hardcoded passwords, SQL injection, command injection. Programmatic API via `bandit.manager.BanditManager` [17]. |
| **mypy** | 1.13+ | Static type checking | Count type errors as a quality metric. Run with `--strict` for maximum signal. Integrates with evaluation rubric [18]. |
| **lizard** | 1.17+ | Cognitive complexity (multi-language) | Cyclomatic complexity and nloc for C/C++, Java, JavaScript, TypeScript, Python, Swift. Essential for multi-language repo analysis [19]. |
| **ESLint** | 9.x | JavaScript/TS linting | Programmatic Node.js API for linting JS/TS repos. `ESLint.lintFiles()` returns structured results [20]. |

### Async Job Queue & Processing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Celery** | 5.6.x | Async task queue | Industry-standard Python task queue (16+ years). Handles repo cloning, analysis pipelines, LLM evaluation as background jobs. Redis broker + result backend. Beat scheduler for recurring tasks [21]. |
| **Flower** | 2.0+ | Celery monitoring | Real-time web UI for Celery workers, task history, queue depth. Essential for debugging pipeline issues [22]. |

### Report Generation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **WeasyPrint** | 69.x | PDF report generation | Pure Python HTML/CSS-to-PDF engine (no headless browser). Produces 50-80% smaller PDFs than Playwright. Best for server-rendered evaluation reports with no JS dependencies. Simple reports generate in 227ms cold [23]. |
| **Playwright** | 1.50+ (Python bindings) | Complex PDF generation | Full Chromium engine for pixel-perfect reports with charts, CSS Grid, custom fonts. Use when evaluation reports include interactive Chart.js visualizations rendered to PDF. Warm pool: 3-13ms per render [23]. |

### Data Access Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **SQLAlchemy 2.0** | 2.0+ | ORM | Async-native (`asyncpg` driver), repository pattern, composable queries. The standard Python ORM in 2026 [24]. |
| **Alembic** | 1.18.x | Database migrations | SQLAlchemy-native migration tool, auto-generation from model changes, version tracking. Use from day one [24]. |
| **asyncpg** | 0.30+ | PostgreSQL async driver | Fastest PostgreSQL async driver for Python. Essential for non-blocking DB access under FastAPI [24]. |

### Authentication & User Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **FastAPI Users** | 12.x | Auth framework | FastAPI-native authentication with JWT, OAuth2, password hashing. No vendor lock-in, works with any PostgreSQL schema. For MVP, this is the fastest path to working auth [25]. |
| **Supabase Auth** | (managed service) | Alternative auth | Use if already on Supabase Postgres. RLS integration, built-in OAuth providers. Switch to custom auth when scaling past 50K MAU [25]. |

### Infrastructure & Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Docker** | 24.0+ | Containerization | Standardize dev/prod environments. Multi-stage builds for Python API + Celery workers + Next.js frontend [26]. |
| **Docker Compose** | 2.x | Local orchestration | Single `docker compose up` for PostgreSQL, Redis, FastAPI, Celery workers, Flower, Next.js [26]. |
| **Railway** | (PaaS) | Backend hosting | No timeout ceiling (Celery workers can run 5+ min evaluations), managed Postgres/Redis, Dockerfile deployment, private networking between services, auto-scaling. Best fit for AI SaaS backends in 2026 [27]. |
| **Vercel** | (platform) | Frontend hosting | Edge CDN, Next.js-native deployment, ISR for report caching, Fluid Compute for AI workloads. Frontend-only — keeps auth tokens server-side [27]. |

### Monitoring & Observability

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Sentry** | (SaaS) | Error tracking | Python + Next.js SDKs, performance tracing, release tracking. Essential for debugging LLM pipeline failures [28]. |
| **LangSmith** | (SaaS) | LLM observability | Prompt tracing, token accounting, evaluation datasets. Debug LLM calls in evaluation pipeline — see exactly what was sent/received [29]. |
| **Structlog** | 25.x | Structured logging | JSON log output with request ID propagation across Celery tasks. `grep one-id, see full job history` [30]. |

## Installation

### Backend (Python)

```bash
# Core API
pip install fastapi==0.138.* uvicorn[standard]==0.34.*

# Database
pip install sqlalchemy[asyncio]==2.0.* asyncpg==0.30.* alembic==1.18.*

# GitHub API
pip install githubkit==0.15.* PyGithub==2.9.*

# Static Analysis
pip install radon==6.* ruff==0.9.* bandit==1.7.* mypy==1.13.* lizard==1.17.*

# LLM/AI
pip install pydantic-ai[anthropic,openai]==2.0.* langgraph==0.4.*

# Async tasks
pip install celery[redis]==5.6.* redis==7.*

# Report generation
pip install weasyprint==69.* playwright==1.50.*

# Auth
pip install fastapi-users[sqlalchemy]==12.*

# Observability
pip install sentry-sdk[fastapi]==2.* structlog==25.*

# Dev
pip install pytest==8.* httpx==0.28.* pytest-asyncio==0.25.*
```

### Frontend

```bash
# Create Next.js project
npx create-next-app@latest frontend --typescript --tailwind --app

# UI components
npm install @radix-ui/react-tabs @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install lucide-react recharts

# Styling
npm install tailwindcss@4 @tailwindcss/postcss

# Auth client
# (if using Supabase Auth)
npm install @supabase/supabase-js @supabase/ssr
```

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                      Vercel (Frontend)                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Next.js 16 App Router + React 19                    │ │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────────┐     │ │
│  │  │  Public  │ │Dashboard │ │ Evaluation Report │     │ │
│  │  │  Pages   │ │  (auth)  │ │  Pages (RSC)      │     │ │
│  │  └─────────┘ └──────────┘ └───────────────────┘     │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS (REST + SSE)
┌────────────────────┴─────────────────────────────────────┐
│                   Railway (Backend)                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  FastAPI 0.138 (Uvicorn)                             │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐      │ │
│  │  │ Auth    │ │  Job     │ │  Report Gen      │      │ │
│  │  │ Routes  │ │  Routes  │ │  Endpoints       │      │ │
│  │  └─────────┘ └──────────┘ └──────────────────┘      │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────┴───────────────────────────────┐ │
│  │  Celery Workers (Redis Broker)                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────┐    │ │
│  │  │  Repo    │ │  Static  │ │  LLM Evaluation   │    │ │
│  │  │  Cloner  │ │ Analysis │ │  Workers          │    │ │
│  │  └──────────┘ └──────────┘ └───────────────────┘    │ │
│  │  ┌──────────┐ ┌──────────┐                           │ │
│  │  │  Report  │ │  DLQ     │                           │ │
│  │  │  Gen     │ │  Worker  │                           │ │
│  │  └──────────┘ └──────────┘                           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ PostgreSQL  │  │   Redis 7   │  │   S3 (Reports)  │  │
│  │   (16)      │  │ Cache/Queue │  │                 │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Data Flow: Repository Evaluation

```
1. User submits GitHub URL via Dashboard
2. FastAPI validates → creates Job record in PostgreSQL
3. FastAPI enqueues Celery task → returns 202 { job_id }
4. Celery Worker A: Clones repo (git via subprocess)
   - Stores clone metadata, detects languages
5. Celery Worker B: Static analysis pipeline
   - per-language: ruff/lizard/radon/bandit/mypy/ESLint
   - Aggregates metrics → stores in PostgreSQL
6. Celery Worker C: LLM Evaluation pipeline (Pydantic AI agent)
   - Agent 1: Code Quality assessment
   - Agent 2: Engineering Maturity evaluation
   - Agent 3: Documentation quality analysis
   - Agent 4: Collaboration & contributor health
   - Agent 5: Risk identification & recommendations
   - Each outputs typed Pydantic models → validated at compile time
7. Celery Worker D: Report Generation
   - Compiles all scores into final evaluation
   - Generates PDF via WeasyPrint (or Playwright for complex reports)
   - Uploads to S3, updates Job status to COMPLETED
8. Dashboard polls via SSE → displays report when ready
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| **Backend** | FastAPI (Python) | Express/Fastify (Node.js) | If your **entire team** is JS/TS and AI workload is thin (< 3 LLM calls per evaluation). But you'll lose Python-native static analysis tools and pay latency cost for Python microservice calls [1, 2]. |
| **AI Framework** | Pydantic AI + LangGraph | CrewAI | CrewAI for rapid multi-agent prototyping (< 2 weeks). Graduate to LangGraph for production. CrewAI's production case studies are anonymized — LangGraph has named deployments at Klarna, Uber, LinkedIn, Replit [10, 11]. |
| **AI Framework** | Pydantic AI + LangGraph | LangChain agents | LangChain agents for single-agent-tool workflows where you want fast prototyping. Move to Pydantic AI when you need type-safe structured outputs — LangChain's `with_structured_output()` is provider-dependent and less explicit [8, 9]. |
| **LLM Provider** | Anthropic Claude | OpenAI GPT | OpenAI for multi-modal evaluation (if repo contains images/diagrams). Claude is superior for code understanding and long-context analysis (200K tokens for full repos) [12]. |
| **GitHub Client** | githubkit | PyGithub | PyGithub if you need LGPL license compatibility or want the more conservative API. githubkit if you want async calls, GraphQL, and auto-updating schemas [13, 14]. |
| **Job Queue** | Celery | Temporal | Temporal for long-running (hours+) workflows with complex compensation logic. Celery is sufficient for 5-15 minute evaluation pipelines and has simpler operational overhead [21]. |
| **Job Queue** | Celery | BullMQ | BullMQ if your stack is Node.js-only. Since our AI layer is Python, Celery is the natural choice — cross-language job queues add operational complexity [21]. |
| **PDF Generation** | WeasyPrint (primary) | Playwright | Playwright when reports include JavaScript-rendered charts or complex CSS Grid layouts. WeasyPrint for everything else (smaller PDFs, simpler deps, no browser process) [23]. |
| **Database** | PostgreSQL 16 | TimescaleDB | TimescaleDB if evaluation history creates >100M rows and you need continuous aggregates for dashboard queries. For most repos evaluated (<10K evaluations), native Postgres partitioning + BRIN indexes is sufficient [6]. |
| **Auth** | FastAPI Users | Supabase Auth | Supabase Auth if you're already using Supabase for hosting and want zero-config auth. FastAPI Users if you want zero vendor lock-in and full control [25]. |
| **Auth** | FastAPI Users | Better Auth | Better Auth is TypeScript-only. Since our backend is Python, it would require a separate auth service. Only consider for a dual-stack architecture [25]. |
| **Deployment** | Railway (backend) + Vercel (frontend) | Single Railway project | Single Railway deploys if you want to simplify ops at the cost of losing Vercel's CDN and edge infrastructure. Railway runs containers with no timeout ceiling — essential for Celery workers [27]. |
| **Deployment** | Railway + Vercel | Fly.io | Fly.io if global latency matters for regional users (e.g., evaluation dashboards in APAC with Postgres in APAC). Railway has simpler service composition [27]. |
| **Monorepo** | Separate backend/frontend repos | Turborepo monorepo | Turborepo if you want shared TypeScript types for API contracts. Separate repos if you want independent CI/CD pipelines and deployment [4]. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **AutoGen** (v0.2) | Effectively dead. Microsoft renamed the project; community fork is AG2. No named production deployments at significant scale. Originally a research artifact, not production infrastructure [10, 11]. | Pydantic AI or LangGraph |
| **AutoGen v0.4+** | Complete API rewrite — incompatible with existing community tools and documentation. Too new and unproven (no documented production deployments as of May 2026) [10]. | Pydantic AI or LangGraph |
| **LangChain agents** (as primary framework) | Overabstracted for production — `Runnable` interface devolves to `Runnable[Any, Any]`, structured output is bolted-on, debugging requires stepping through abstraction layers. Good as a **component library** for document loaders/embeddings, not as an agent framework [8, 9, 11]. | Pydantic AI for typed agents |
| **Express.js** (as primary backend) | No type-safe structured output from LLMs, no Python static analysis ecosystem, every LLM call requires a Python microservice call. The context-switch tax between Node and Python for AI work is real [1, 2]. | FastAPI |
| **Django** | Too heavy for an API-first platform. Django ORM is synchronous, admin panel unnecessary (we have a dashboard), and the "batteries-included" philosophy conflicts with FastAPI's lean, async-native approach [3]. | FastAPI |
| **wkhtmltopdf / pdfkit** | Deprecated rendering engine — no longer maintained, poor CSS3 support, struggles with modern frameworks [23]. | WeasyPrint or Playwright |
| **Pyppeteer** | Unmaintained — last significant updates in 2023. Playwright is the successor with a cleaner API and cross-language support [23]. | Playwright |
| **Auth0 / Clerk** | Expensive at scale ($1,025/mo at 100K MAU for Clerk), user data locked in vendor's store, US-only data residency [25]. | FastAPI Users or Supabase Auth |
| **NextAuth (Auth.js v5)** | In maintenance mode — Better Auth is the successor. If you're on NextAuth, plan migration [25]. | Better Auth (for TS) or FastAPI Users (for Python) |
| **BullMQ** | Excellent Node.js queue, but our stack is Python. Running BullMQ alongside Celery for cross-language queues adds operational complexity without benefit [21]. | Celery |
| **Pinecone / Weaviate** (vector DB) | Premature optimization. You don't need vector search until you implement RAG over evaluation results. PostgreSQL + pgvector handles the first 100K embeddings [6]. | PostgreSQL + pgvector |
| **Kubernetes** | Overkill for a team of 1-5 developers at MVP stage. Railway handles container orchestration, auto-scaling, and zero-downtime deploys without a kubeconfig [27]. | Railway |

## Stack Patterns by Variant

**If team is primarily TypeScript developers:**
- Use: Next.js API routes for lightweight API layer, Python FastAPI as a microservice for AI/analysis pipelines
- Because: Your team ships faster in TypeScript. The API gateway in Next.js handles auth, rate limiting, and orchestration. Python microservice handles only AI/LLM/analysis calls over internal HTTP
- Cost: You pay for a Python service deployment + extra latency per analysis call

**If evaluating < 10 repos/day (low volume):**
- Use: Celery with `solo` pool (single-threaded, no pre-fork overhead), synchronous WeasyPrint, no worker scaling
- Because: 10 evaluations/day at 5 minutes each = < 1 hour of processing. No need for distributed workers
- Upgrade path: Switch Celery pool to `prefork`, add Redis, scale workers horizontally

**If evaluating > 100 repos/day (high volume):**
- Use: Dedicated Celery worker pools per task type (clone vs analysis vs LLM), RabbitMQ broker instead of Redis (better durability), Playwright with warm browser pool for PDFs
- Because: LLM evaluation becomes the bottleneck. Isolating worker types prevents a slow analysis from starving LLM tasks. RabbitMQ handles higher throughput with better persistence guarantees

**If reports need interactive charts:**
- Use: React-based report viewer in Next.js (Server Components load data, client components render charts with Recharts). PDF export via Playwright
- Because: HTML reports are interactive and load instantly. PDFs are a fallback for download/printing
- Alternative: WeasyPrint with server-rendered chart images (matplotlib/plotly exported as PNG)

**If deploying to a single platform (simplified ops):**
- Use: Railway for EVERYTHING (Next.js frontend + FastAPI API + Celery workers + Postgres + Redis)
- Because: Single platform = single bill, single dashboard, simpler networking
- Cost: Lose Vercel's edge CDN and ISR. Railway containers are always-on (no scale-to-zero like Vercel functions)

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fastapi 0.138.x | Python 3.10+, pydantic 2.x | Latest stable as of June 2026 |
| pydantic-ai 2.0.0 | Python 3.10+, pydantic 2.x | Released June 23, 2026 — V2 is now stable after 7 betas [8] |
| langgraph 0.4.x | Python 3.10+, langchain-core | April 2026 release sharpened state persistence and HITL checkpoints |
| githubkit 0.15.x | Python 3.10+, httpx | Schema auto-generated from GitHub's OpenAPI — lock version with poetry/pdm/uv to avoid unexpected breaking changes from upstream schema changes [13] |
| celery 5.6.x | Redis 6.2+ (for broker), Python 3.10+ | `acks_late=True` for at-least-once delivery. Set `worker_prefetch_multiplier=1` to prevent one slow task from blocking a batch [21] |
| weasyprint 69.x | Python 3.10+, Pango/Cairo system libs | Requires `libpango-1.0-0`, `libcairo2`, `libgdk-pixbuf2.0-0` on the system (Docker handles this) |
| playwright 1.50+ | Python 3.10+, Chrome/Chromium (~300MB) | Install with `playwright install chromium`. Not compatible with `python:alpine` — use `python:3.12-slim` |
| sqlalchemy 2.0.x | asyncpg 0.30+, Python 3.10+ | Use `postgresql+asyncpg://` connection string. Never use `postgresql://` in async context — it blocks the event loop [24] |
| next.js 16.x | React 19, Node.js 20+ | App Router is default. Pages Router still supported but not recommended for new projects [4] |
| tailwindcss 4.x | Next.js 16 | New v4 uses `@tailwindcss/postcss` plugin instead of the postcss-import chain. Breaking changes from v3 [4] |

## Sources

- [1] Groovy Web (2026-02-21). "Node.js vs Python Backend in 2026: Real Benchmarks, AI Stack, Hiring Cost" — MEDIUM confidence (popular press, aligns with other sources)
- [2] DEV Community (2026-04-20). "Node.js vs Python for AI Backends in 2026" — MEDIUM confidence (community expertise)
- [3] FastAPI official docs — HIGH confidence
- [4] StarterPick (2026-03-16). "Next.js vs SvelteKit vs Nuxt for SaaS 2026" — MEDIUM confidence
- [5] MakerKit (2026-05-08). "The Best SaaS Stack in 2026: Build Production Apps Fast" — HIGH confidence (production SaaS builder)
- [6] DEV Community (2026-05-23). "Time-Series in Postgres: When TimescaleDB Wins" — HIGH confidence (detailed benchmarks)
- [7] BullMQ docs / Redis docs — HIGH confidence
- [8] Pydantic AI official docs v2.0.0 release (2026-06-23) — HIGH confidence
- [9] DEV Community (2026-05-30). "Pydantic AI vs LangChain vs instructor: structured LLM outputs compared" — MEDIUM confidence
- [10] ODSEA Blog (2026-05-26). "LangGraph vs. CrewAI vs. AutoGen: Which Multi-Agent Framework Actually Ships to Production?" — HIGH confidence (named production deployments cited)
- [11] Alice Labs (2026-04-14). "AI Agent Frameworks 2026: Production-Tested Ranking" — MEDIUM confidence (18+ production deployments)
- [12] Anthropic Claude API docs — HIGH confidence
- [13] githubkit docs v0.15.5 (2026-05-01) — HIGH confidence
- [14] PyGithub v2.9.1 (2026-04-14) — HIGH confidence
- [15] Ruff docs / GitHub (astral-sh/ruff) — HIGH confidence
- [16] Radon 6.0.1 documentation — HIGH confidence
- [17] Bandit 1.7+ documentation — HIGH confidence
- [18] mypy 1.13+ documentation — HIGH confidence
- [19] lizard (terryyin/lizard) GitHub — MEDIUM confidence
- [20] ESLint official docs — HIGH confidence
- [21] Celery 5.6 docs / DevOpsNess (2026-05-10) — HIGH confidence
- [22] Flower (mher/flower) GitHub — MEDIUM confidence
- [23] PDF4.dev (2026-04-24). "Playwright vs WeasyPrint: PDF generation in Python (2026 comparison)" — HIGH confidence (detailed benchmarks)
- [24] DEV Community (2026-03-22). "Building a Production-Grade Async Backend with FastAPI, SQLAlchemy, PostgreSQL, and Alembic" — HIGH confidence
- [25] Alex Cloudstar (2026-04-20). "Better Auth vs Clerk vs Supabase Auth (2026 Guide)" / WorkOS (2026-02-12). "Top 5 authentication solutions for secure FastAPI apps in 2026" — HIGH confidence
- [26] Docker official docs — HIGH confidence
- [27] Railway official docs / Vercel Knowledge Base (2026-06-05). "Vercel vs Railway" — HIGH confidence
- [28] Sentry Python SDK docs — HIGH confidence
- [29] LangSmith docs — MEDIUM confidence
- [30] Structlog docs — MEDIUM confidence

---

*Stack research for: AI-powered Project Intelligence & Evaluation Platform*
*Researched: 2026-06-28*
