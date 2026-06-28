# Architecture Research

**Domain:** AI-Powered Code Analysis & Evaluation Platform
**Researched:** 2026-06-28
**Confidence:** HIGH

## Standard Architecture

### System Overview

The standard architecture for AI-powered code analysis platforms follows an **event-driven, multi-stage pipeline** pattern. The API layer and heavy processing are decoupled via async job queues. Analysis flows through distinct stages (fetch → static analysis → AI evaluation → report generation), often with parallel agent execution within the AI evaluation stage.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   Dashboard UI     │  │  Report Viewer   │  │  Settings Panel  │ │
│  │  (Next.js 15 SSR)  │  │  (Interactive)   │  │  (Multi-tenant)  │ │
│  └─────────┬──────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│            │                      │                      │           │
├────────────┴──────────────────────┴──────────────────────┴───────────┤
│                          API GATEWAY                                  │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  REST API (Next.js API routes / FastAPI)         WebSocket SSE  ││
│  │  ┌──────┐ ┌───────┐ ┌──────┐ ┌──────┐ ┌──────┐  ┌──────────┐  ││
│  │  │ Auth │ │ Rate  │ │Valid-│ │Repo  │ │Report│  │ Live     │  ││
│  │  │      │ │ Limit │ │ation │ │Mgmt  │ │Export│  │ Status   │  ││
│  │  └──────┘ └───────┘ └──────┘ └──────┘ └──────┘  └──────────┘  ││
│  └──────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                     ASYNC JOB QUEUE (BullMQ / Celery / Temporal)     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  ┌──────────┐  ┌──────────────────┐  ┌──────────────────────┐ │ │
│  │  │ Producer │─▶│  Redis Broker    │─▶│  Worker Pool (scale) │ │ │
│  │  │ (API)    │  │  (Job State)     │  │  ┌────────────────┐  │ │ │
│  │  └──────────┘  └──────────────────┘  │  │ Stage 1: Fetch │  │ │ │
│  │                                      │  ├────────────────┤  │ │ │
│  │       Dead Letter Queue ────────────▶│  │ Stage 2: SAST  │  │ │ │
│  │                                      │  ├────────────────┤  │ │ │
│  │                                      │  │ Stage 3: AI    │  │ │ │
│  │                                      │  ├────────────────┤  │ │ │
│  │                                      │  │ Stage 4: Report│  │ │ │
│  │                                      │  └────────────────┘  │ │ │
│  └─────────────────────────────────────────────────────────────┘ │ │
├─────────────────────────────────────────────────────────────────────┤
│                     DATA LAYER                                        │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  ┌─────────┐  │
│  │  PostgreSQL  │  │  Redis Cache   │  │  Object    │  │ Vector  │  │
│  │  (Primary)   │  │  (Rate Limit   │  │  Store     │  │ Store   │  │
│  │  - Tenants   │  │   + Sessions)  │  │  (Git      │  │ (Optional:│ │
│  │  - Projects  │  │                │  │   clones)  │  │ embeddings│ │
│  │  - Reports   │  └────────────────┘  └────────────┘  └─────────┘  │
│  └──────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Web Dashboard** | User auth, project management, report viewing, settings | Next.js 15+ with App Router, React Server Components, Tailwind CSS |
| **API Gateway** | Auth (JWT/GitHub OAuth), rate limiting, input validation, request routing | Next.js API Routes or separate FastAPI/NestJS service |
| **Job Queue** | Decouple HTTP requests from async processing, burst absorption, retries with backoff | BullMQ (Node.js/Redis) or Celery (Python/Redis) |
| **Worker Pipeline** | Execute multi-stage analysis: fetch repo → static analysis → AI evaluation → report generation | LangGraph orchestration for stage sequencing |
| **GitHub Integration Service** | Fetch repo metadata, commit history, PRs, issues, file tree; handle rate limiting | Octokit (JS) or PyGitHub with exponential backoff + caching |
| **Static Analysis Engine** | Run linters, code quality tools, complexity metrics | ESLint, Ruff, tree-sitter, Semgrep, cloc — wrapped in containers |
| **AI Agent Orchestrator** | Manage parallel LLM agents for multi-dimensional evaluation | LangGraph StateGraph with parallel nodes, fan-in aggregation |
| **Report Generator** | Synthesize all findings into structured report with scores, rankings, recommendations | Templated JSON schema → Markdown/PDF rendering |
| **Database** | Multi-tenant data storage (projects, reports, users, rubrics) | PostgreSQL with shared schema + tenant_id + RLS |
| **Cache** | GitHub API responses, session state, rate limit counters | Redis (separate from job queue Redis) |

### Data Model (Core Entities)

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Tenant    │       │    Project       │       │  Repository      │
│  (org/user) │1──N▶│  (user's repo    │       │  Snapshot         │
│             │       │   entry)        │1──1│  (point-in-time   │
│ - id        │       │ - id            │       │   clone/metadata)│
│ - name      │       │ - tenant_id     │       │ - id             │
│ - plan      │       │ - repo_url      │       │ - project_id     │
│ - api_keys  │       │ - status        │       │ - commit_sha     │
└─────────────┘       │ - rubric_id     │       │ - fetched_at     │
                      │ - created_at    │       │ - file_tree      │
                      └────────┬─────────┘       │ - metadata_json  │
                               │                 └────────┬─────────┘
                               │                          │
                      ┌────────▼──────────────────────────▼─────────┐
                      │              Analysis Run                   │
                      │  (one execution of the pipeline)            │
                      │  - id (PK)                                  │
                      │  - project_id (FK)                          │
                      │  - snapshot_id (FK)                         │
                      │  - status: pending/fetching/analyzing/      │
                      │             evaluating/reporting/done/failed│
                      │  - started_at / completed_at                │
                      │  - error_log                                │
                      └────────┬────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────────┐
     │ Static Analysis│ │ AI Agent   │ │  Evaluation      │
     │ Results        │ │ Results    │ │  Report          │
     │ (per-analysis) │ │ (per-agent)│ │  (aggregated)    │
     │ - run_id (FK)  │ │ - run_id   │ │  - run_id (FK)   │
     │ - tool_name    │ │ - agent    │ │  - summary        │
     │ - metrics JSON │ │   name     │ │  - category_scores│
     │ - issues[]     │ │ - findings │ │  - overall_score  │
     │ - file_coverage│ │   JSON     │ │  - rubric_version │
     │ - complexity   │ │ - score    │ │  - recommendations│
     └────────────────┘ │ - evidence │ │  - risk_flags     │
                        └─────┬──────┘ └───────────────────┘
                              │
                     ┌────────▼────────┐
                     │  Agent Findings │
                     │  (individual   │
                     │   LLM outputs) │
                     │ - agent_name   │
                     │ - dimension    │
                     │ - score        │
                     │ - evidence     │
                     │ - severity     │
                     └────────────────┘
```

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router (SSR, API, pages)
│   ├── (auth)/                   # Auth pages (login, callback)
│   │   ├── login/
│   │   └── callback/
│   ├── (dashboard)/              # Authenticated routes
│   │   ├── layout.tsx            # Sidebar + header layout
│   │   ├── page.tsx              # Dashboard home — project list + stats
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx      # Project detail + analysis history
│   │   │   │   └── reports/
│   │   │   │       └── [reportId]/
│   │   │   │           └── page.tsx  # Full evaluation report
│   │   │   └── new/
│   │   │       └── page.tsx      # New project form
│   │   ├── settings/
│   │   │   ├── profile/
│   │   │   └── team/
│   │   └── api/                  # API routes
│   │       ├── auth/             # GitHub OAuth / JWT
│   │       ├── projects/         # CRUD + trigger analysis
│   │       ├── reports/          # Fetch reports, export
│   │       ├── webhooks/         # GitHub webhook receiver
│   │       └── status/           # SSE endpoint for live status
│   └── layout.tsx                # Root layout (providers, theme)
│
├── components/                   # Shared React components
│   ├── ui/                       # shadcn/ui primitives
│   ├── dashboard/                # Project list, stats cards, KPIs
│   ├── reports/                  # Report viewer components
│   │   ├── ScoreRadar.tsx        # Spider/radar chart
│   │   ├── ScoreGauge.tsx        # Overall score gauge
│   │   ├── FindingsList.tsx      # Severity-ranked findings
│   │   ├── RubricBreakdown.tsx   # Per-criterion scoring
│   │   ├── Recommendations.tsx   # Actionable recommendation cards
│   │   └── RiskFlags.tsx         # Risk flag badges
│   ├── charts/                   # Recharts wrappers
│   └── forms/                    # Project creation, settings forms
│
├── lib/                          # Shared utilities
│   ├── db/                       # Drizzle ORM schema + client
│   │   ├── schema/               # Multi-tenant schema definitions
│   │   ├── migrations/
│   │   └── client.ts
│   ├── auth/                     # Auth helpers (NextAuth.js / Auth.js)
│   ├── github/                   # GitHub API client (Octokit)
│   │   ├── client.ts             # Authenticated Octokit instance
│   │   ├── rate-limiter.ts       # Rate limit tracking + caching
│   │   ├── fetch-repo.ts         # Repo metadata + file tree
│   │   ├── fetch-commits.ts      # Commit history + contributors
│   │   ├── fetch-prs.ts          # PR + review data
│   │   └── fetch-issues.ts       # Issue tracker analysis
│   ├── queue/                    # BullMQ queue definitions
│   │   ├── queues.ts             # Queue names + options
│   │   ├── workers/              # Worker processors
│   │   └── connection.ts         # Redis connection pool
│   └── utils/                    # General utilities
│
├── agents/                       # AI Agent system
│   ├── orchestrator.ts           # LangGraph pipeline definition
│   ├── agents/                   # Individual specialized agents
│   │   ├── code-quality.ts       # Code quality assessment agent
│   │   ├── engineering-maturity.ts # Engineering maturity agent
│   │   ├── documentation.ts      # Documentation quality agent
│   │   ├── collaboration.ts      # Collaboration/contributor agent
│   │   ├── project-health.ts     # Overall project health agent
│   │   └── recommendations.ts    # Recommendation generator agent
│   ├── prompts/                  # System prompts for each agent
│   ├── schemas/                  # Structured output schemas (Zod)
│   └── judge.ts                  # Aggregator/Judge agent (optional)
│
├── analyzers/                   # Static analysis (deterministic)
│   ├── code-complexity.ts       # Cyclomatic complexity, LOC
│   ├── dependency-analysis.ts   # Dep graph, outdated deps
│   ├── test-coverage.ts         # Test file ratio analysis
│   ├── security-scanner.ts      # Semgrep wrapper
│   └── standards.ts             # Lint config detection
│
├── pipeline/                    # Pipeline orchestration
│   ├── runner.ts                # Main analysis pipeline runner
│   ├── stages.ts                # Stage definitions + ordering
│   ├── types.ts                 # Pipeline types
│   └── hooks.ts                 # Pipeline lifecycle hooks (logging, metrics)
│
├── workers/                     # BullMQ worker processes
│   ├── index.ts                 # Worker entry point
│   ├── analysis.worker.ts       # Main analysis pipeline worker
│   └── webhook.worker.ts        # GitHub webhook worker
│
├── jobs/                        # Job definitions
│   ├── analysis.job.ts          # Trigger analysis job
│   └── cleanup.job.ts           # Periodic cleanup job
│
├── reports/                     # Report generation
│   ├── generator.ts             # JSON report builder
│   ├── templates/               # Report content templates
│   ├── exporter.ts              # PDF/Markdown export
│   └── scoring.ts               # Weighted scoring engine
│
└── config/                      # Configuration
    ├── site.ts                  # Site-wide config
    ├── agents.ts                # Agent configuration (model, params)
    ├── rubrics.ts                # Default rubric definitions
    └── limits.ts                # Rate limits, timeouts, quotas
```

### Structure Rationale

- **`app/` (Next.js App Router):** Server Components for data-heavy pages (report loading, project lists), Client Components for interactive report widgets. API routes co-located with pages for shared route segment logic.
- **`agents/`:** Sits separately from the web layer because agents are heavy compute units invoked by workers, not the web server. Each agent is a self-contained module with its own prompt, schema, and evaluation logic — making them independently testable and swappable.
- **`analyzers/`:** Deterministic analysis tools that run before/alongside AI agents. These produce ground-truth metrics (LOC, test coverage, dependency freshness) that agents consume as context. Separating them from agents enforces a clear boundary: analyzers are deterministic, agents are probabilistic.
- **`pipeline/`:** The orchestration layer that sequences stages. Kept separate from worker code so the pipeline can be tested independently of the queueing infrastructure.
- **`workers/`:** Thin entry-point files that connect BullMQ workers to pipeline execution. The worker code should be minimal — it's a queue listener, not business logic.
- **`lib/github/`:** GitHub API calls isolated from the rest of the system. This makes rate limiting, caching, and error handling consistent across all consumers.

## Architectural Patterns

### Pattern 1: Event-Driven Multi-Stage Pipeline

**What:** The analysis pipeline is decomposed into discrete stages (fetch → static analysis → AI evaluation → report generation), each triggered by the completion of the previous stage. Stages communicate through the job queue rather than direct function calls.

**When to use:** Always for this domain. Analysis takes 2-10 minutes — the user cannot wait synchronously. The queue absorbs traffic bursts when multiple users trigger analysis simultaneously.

**Trade-offs:**
- (+): Decouples HTTP response from processing — API returns 202 immediately
- (+): Each stage can scale independently (more AI workers, fewer fetchers)
- (+): Retry each stage independently (GitHub rate limit failure ≠ re-run AI)
- (-): Adds latency for short pipelines (queue overhead ~50ms per stage)
- (-): State management across stages is more complex than a single function call

**Example:**
```typescript
// Pipeline stage definition
interface PipelineStage<TInput, TOutput> {
  name: string;
  execute(input: TInput, context: PipelineContext): Promise<TOutput>;
  onFailure?: (error: Error, input: TInput) => Promise<void>;
}

// Pipeline runner orchestrates stages
class AnalysisPipeline {
  private stages: PipelineStage<any, any>[] = [
    new RepoFetchStage(),        // Stage 1: Clone + metadata
    new StaticAnalysisStage(),   // Stage 2: Run linters
    new AIEvaluationStage(),     // Stage 3: LLM agents
    new ReportGenerationStage(), // Stage 4: Build report
  ];

  async run(projectId: string): Promise<AnalysisReport> {
    let context = { projectId, startTime: Date.now() };
    for (const stage of this.stages) {
      context = await stage.execute(context);
      // Progress stored in DB for real-time dashboard updates
      await this.recordProgress(stage.name, context);
    }
    return context.report;
  }
}
```

### Pattern 2: Parallel Agent Orchestration with Fan-In Aggregation

**What:** Multiple specialized AI agents run in parallel, each evaluating a different dimension (code quality, security, performance, documentation). A collector agent or scoring function aggregates their findings into a unified report. Optionally, a judge agent scores and deduplicates findings.

**When to use:** When multiple evaluation dimensions are independent and can be scored concurrently. This is the dominant pattern in production multi-agent code review systems (Anviksha, CodeRabbit, Screvyn).

**Trade-offs:**
- (+): Each agent maintains a focused context window → higher quality per dimension
- (+): Total wall-clock time = slowest single agent, not sum of all agents
- (+): Agents can use different model tiers (cheap model for docs, frontier for security)
- (-): Token costs multiply (N agents × tokens per agent)
- (-): Need deduplication/conflict resolution when agents disagree
- (-): Structured output parsing is critical — malformed JSON from one agent shouldn't block others

**Example (LangGraph StateGraph):**
```typescript
import { StateGraph, END } from "@langchain/langgraph";

type AgentState = {
  repoData: RepoData;
  staticMetrics?: StaticMetrics;
  codeQuality?: AgentFinding;
  engineeringMaturity?: AgentFinding;
  documentation?: AgentFinding;
  collaboration?: AgentFinding;
  projectHealth?: AgentFinding;
  aggregatedReport?: AggregatedReport;
};

const graph = new StateGraph<AgentState>({
  channels: {
    repoData: { value: (a, b) => b ?? a },
    staticMetrics: { value: (a, b) => b ?? a },
    codeQuality: { value: (a, b) => b ?? a },
    engineeringMaturity: { value: (a, b) => b ?? a },
    documentation: { value: (a, b) => b ?? a },
    collaboration: { value: (a, b) => b ?? a },
    projectHealth: { value: (a, b) => b ?? a },
    aggregatedReport: { value: (a, b) => b ?? a },
  }
})
  .addNode("fetch_repo", fetchRepoNode)
  .addNode("static_analysis", staticAnalysisNode)
  .addNode("code_quality_agent", createAgentNode("codeQuality"))
  .addNode("maturity_agent", createAgentNode("engineeringMaturity"))
  .addNode("docs_agent", createAgentNode("documentation"))
  .addNode("collab_agent", createAgentNode("collaboration"))
  .addNode("health_agent", createAgentNode("projectHealth"))
  .addNode("aggregator", aggregatorNode)
  .addEdge("fetch_repo", "static_analysis")
  // Fan-out: static_analysis triggers all 5 agents in parallel
  .addEdge("static_analysis", "code_quality_agent")
  .addEdge("static_analysis", "maturity_agent")
  .addEdge("static_analysis", "docs_agent")
  .addEdge("static_analysis", "collab_agent")
  .addEdge("static_analysis", "health_agent")
  // Fan-in: all agents must complete before aggregator
  .addEdge("code_quality_agent", "aggregator")
  .addEdge("maturity_agent", "aggregator")
  .addEdge("docs_agent", "aggregator")
  .addEdge("collab_agent", "aggregator")
  .addEdge("health_agent", "aggregator")
  .addEdge("aggregator", END);
```

### Pattern 3: Multi-Tenant Shared Schema with Row-Level Security

**What:** A single PostgreSQL database with a `tenant_id` column on every tenant-scoped table, composite indexes leading with `tenant_id`, and Row-Level Security policies that enforce tenant isolation at the database layer.

**When to use:** Default approach for B2B SaaS with up to ~5,000 tenants. The only pattern that scales operationally without a dedicated platform team.

**Trade-offs:**
- (+): Single schema, single migration — lowest operational overhead
- (+): RLS acts as safety net against missing `WHERE tenant_id = $1` in queries
- (+): Scales to thousands of tenants on one Postgres instance
- (-): Noisy neighbor risk — one tenant's heavy query can degrade others
- (-): Harder to do per-tenant backup/restore
- (-: Enterprise compliance (HIPAA, SOC 2) may require physical isolation

**Example:**
```sql
-- Every tenant-scoped table includes tenant_id
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  repo_url TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite index leading with tenant_id
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id, id);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

### Pattern 4: GitHub API Caching with Stale-While-Revalidate

**What:** Cache GitHub API responses aggressively using Redis with short TTLs, but serve stale data while revalidating in the background. This prevents hitting GitHub's hourly rate limit (5,000 requests/hour for authenticated users).

**When to use:** Essential for any application that reads GitHub data. Repository metadata, commit counts, language stats, and contributor data change slowly enough that 5-minute stale data is acceptable.

**Trade-offs:**
- (+): Reduces GitHub API consumption by 10-50x for popular repos
- (+): Faster response times (cached data vs network round-trip)
- (-): Cache invalidation complexity — webhooks help but add complexity
- (-): First request for any repo always misses cache (cold start)

```typescript
// Stale-while-revalidate cache pattern
async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300,
  staleSeconds: number = 900
): Promise<T> {
  const cached = await redis.get(key);
  const staleTime = await redis.ttl(key);

  if (cached && staleTime < 0) {
    // Key expired but we haven't cleaned up — stale-while-revalidate
    // Fire background refresh, return stale data
    revalidateInBackground(key, fetcher, ttlSeconds);
    return JSON.parse(cached);
  }

  if (cached && staleTime > 0) {
    // Fresh cache hit
    return JSON.parse(cached);
  }

  // Cache miss — fetch and store
  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}
```

## Data Flow

### Request Flow (New Analysis)

```
User submits repo URL
    ↓
POST /api/projects [Next.js API Route]
    ↓
1. Auth check (session/JWT → extract tenant_id)
2. Validate URL format + repo accessibility (HEAD request to GitHub)
3. Verify rate limit quota (tenant-level + global)
4. Create Project record in DB (status: "pending")
5. Enqueue analysis job in BullMQ (queue: "analysis")
6. Return { projectId, status: "pending" } to client (HTTP 202)
    ↓
[BullMQ Broker — Redis]
    ↓
Worker picks up job
    ↓
Worker: PipelineRunner.execute(projectId)
    ↓
┌─ Stage 1: FETCH ──────────────────────────────────────────────┐
│ 1. Fetch repo metadata via Octokit (cached)                    │
│ 2. Clone repo (or fetch archive) → store in temp workspace     │
│ 3. Fetch commit history, contributors, PRs, issues             │
│ 4. Build file tree + language detection                        │
│ 5. Store RepositorySnapshot in DB                              │
│ 6. Update Project.status → "fetching_complete"                  │
└───────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 2: STATIC ANALYSIS ─────────────────────────────────────┐
│ 1. Run code complexity metrics (cyclomatic, LOC, files)        │
│ 2. Parse dependency files (package.json, requirements.txt)     │
│    → dependency freshness + outdated count                     │
│ 3. Detect CI config, test framework, lint config               │
│ 4. Run Semgrep for security pattern scanning                   │
│ 5. Analyze commit frequency + contribution distribution        │
│ 6. Store StaticAnalysisResults in DB                           │
│ 7. Update Project.status → "analyzed"                          │
└───────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 3: AI EVALUATION ───────────────────────────────────────┐
│ 1. Extract context: repo metadata + static results + file tree │
│ 2. Fan-out to 5 parallel agents (LangGraph StateGraph):        │
│    ├─ Code Quality Agent    ← scores code structure + health   │
│    ├─ Engineering Maturity  ← scores process + practices       │
│    ├─ Documentation Agent   ← scores README + docs + comments  │
│    ├─ Collaboration Agent   ← scores contributors + PRs        │
│    └─ Project Health Agent  ← scores activity + maintenance    │
│ 3. Fan-in: Aggregator merges findings, deduplicates, scores    │
│ 4. Optional: Judge agent validates high-severity findings      │
│ 5. Store AgentResults + aggregated scores in DB                │
│ 6. Update Project.status → "evaluated"                         │
└───────────────────────────────────────────────────────────────┘
    ↓
┌─ Stage 4: REPORT GENERATION ───────────────────────────────────┐
│ 1. Combine static metrics + agent findings + rubric definition │
│ 2. Compute weighted scores per category                        │
│ 3. Generate risk flags + strength/weakness identification      │
│ 4. Generate actionable recommendations                         │
│ 5. Build AnalysisReport record + store in DB                   │
│ 6. Update Project.status → "completed"                         │
│ 7. Emit SSE event → dashboard receives "completed" notification│
└───────────────────────────────────────────────────────────────┘
    ↓
Dashboard fetches /api/reports/:reportId
    ↓
Client renders interactive report (scores, charts, findings)
```

### Real-Time Status Updates

```
Worker updates progress in DB ──▶ Project.status changes
                                    │
                              Worker publishes SSE event
                                    │
                              Redis Pub/Sub channel: "project:{id}"
                                    │
                              API Gateway SSE endpoint
                              (subscribed to Redis channel)
                                    │
                              Server-Sent Events to client browser
                              "data: { status: 'analyzing', stage: 'ai_evaluation' }"
                                    │
                              Dashboard updates progress bar
```

### Webhook-Driven Flow (Post-MVP)

```
GitHub (PR opened / push)
    ↓
POST /api/webhooks/github (HMAC verification)
    ↓
Validate event type + repo
    ↓
Enqueue analysis job (or re-analyze existing project)
    ↓
Same pipeline as above
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users / 50 repos/day** | Monorepo (Next.js + all-in-one). Single BullMQ worker process. SQLite or shared Postgres. Redis on same instance. No separate worker process — use in-process queue or simple background job. |
| **100-1k users / 500 repos/day** | Separate worker processes (deploy as separate service). Dedicated Redis instance for queues. PostgreSQL with RLS multi-tenancy. GitHub API caching with Redis becomes critical. Workers scaled to 2-4 instances. |
| **1k-10k users / 5000 repos/day** | Worker pool auto-scaling (KEDA based on queue depth). Separate Redis for cache vs. queue. Object storage for repo clone artifacts. Consider Temporal for long-running pipeline orchestration. Read replicas for report queries. CDN for report exports. |
| **10k+ users / 50k repos/day** | Microservice split: separate repo-fetch service, analysis service, report service. Dedicated GPU-backed model server for LLM inference if self-hosting. Database-per-tenant for enterprise customers. Multi-region deployment. |

### Scaling Priorities

1. **First bottleneck: GitHub API rate limits.**
   - Without aggressive caching, you hit 5,000 req/hr very quickly.
   - Fix: Stale-while-revalidate cache with Redis (Pattern 4). Per-token rate limit tracking. Queue analysis jobs when rate limit is low. Use GitHub App installation tokens (higher limits, 5K req/hr per installation).

2. **Second bottleneck: LLM token costs and latency.**
   - 5 parallel agents × ~10K tokens each × multiple repos = $0.50-$2.00 per analysis at GPT-4o pricing.
   - Fix: Use tiered models (cheap model for docs, high-quality for security). Batch prompts. Cache similar repo contexts. Allow users to select evaluation depth. Consider Gemini 2.5 Flash ($0.15/M tokens vs GPT-4o $10/M).

3. **Third bottleneck: Worker throughput during burst.**
   - If 50 users submit at once, a single worker queues them sequentially — last user waits 50 × 5 min = 4+ hours.
   - Fix: Horizontal scaling of workers. Auto-scale on queue depth (KEDA). Ensure workers are stateless and idempotent.

## Anti-Patterns

### Anti-Pattern 1: Synchronous Analysis in API Request Handler

**What people do:** Running the full analysis pipeline inside the HTTP request handler and returning the report synchronously after 3-5 minutes.

**Why it's wrong:** HTTP requests have timeouts (typically 30-60s in load balancers, 300s in some proxies). The user's browser/tab may be killed waiting. GitHub webhooks expect a response in 10 seconds. This blocks the server from handling other requests during the analysis window.

**Do this instead:** Accept the request immediately (HTTP 202 Accepted), enqueue a job, and poll for completion. Use Server-Sent Events or WebSockets to push status updates to the client. The dashboard shows real-time progress for a better UX.

### Anti-Pattern 2: Single Monolithic AI Prompt

**What people do:** Sending the entire repository context in one massive prompt asking the LLM to evaluate everything at once — code quality, documentation, security, collaboration, project health.

**Why it's wrong:** Context windows fill up fast (repo analysis can easily exceed 200K tokens). The LLM's attention dilutes across dimensions, producing shallow analysis in all areas rather than deep analysis in any. One dimension's failure (e.g., parsing JSON output) blocks all results.

**Do this instead:** Split into specialized agents, each receiving only the context relevant to their dimension (Pattern 2). Fan-out → parallel execution → fan-in with aggregation. Each agent has a focused prompt, returns structured output, and can fail independently.

### Anti-Pattern 3: Ignoring Deterministic Analysis

**What people do:** Replacing all static analysis with LLM calls because "AI can do everything."

**Why it's wrong:** LLMs hallucinate metrics, struggle with exact counting (lines of code, contributors), and are expensive for operations that tools like `cloc`, `eslint`, or `semgrep` do perfectly for free. LLM output for "how many contributors" is unreliable; `GET /repos/owner/repo/contributors` is exact.

**Do this instead:** Hybrid approach — deterministic tools for measurable facts (LOC, contributor count, lint errors, dependency versions), LLM agents for subjective evaluation (code quality, engineering maturity, documentation completeness). Inject static analysis results as ground truth context for AI agents.

### Anti-Pattern 4: Single Database for Everything

**What people do:** Using PostgreSQL for both transactional data AND caching AND job queues AND session state.

**Why it's wrong:** Job queues poll the database (SELECT ... FOR UPDATE SKIP LOCKED), creating lock contention. Cache expiration requires cleanup queries. Session lookups add unnecessary load. Redis exists for exactly these use cases.

**Do this instead:** Separate concerns:
- PostgreSQL → transactional data (users, projects, reports, rubrics)
- Redis (instance 1) → job queue (BullMQ)
- Redis (instance 2) → cache + rate limits + SSE pub/sub
- Object store (S3/R2) → repo clone artifacts, generated PDF reports

### Anti-Pattern 5: Processing GitHub Webhooks Synchronously

**What people do:** When a GitHub webhook arrives (PR opened, push), processing the entire review inline before returning a 200 OK to GitHub.

**Why it's wrong:** GitHub expects a 200 response within 10 seconds. A full AI review takes 30 seconds to 5 minutes. The webhook will timeout, and GitHub will retry, causing duplicate processing.

**Do this instead:** Verify the webhook signature immediately (fast), acknowledge with 200 OK, then enqueue a job for processing. Use the job ID for deduplication (GitHub webhook `delivery` header) to prevent duplicate jobs.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **GitHub API (REST/GraphQL)** | Octokit SDK with exponential backoff + retry | Rate limit: 5,000 req/hr (authenticated), 1,000 req/hr (unauthenticated). Always use a GitHub App or OAuth token. Cache aggressively. |
| **GitHub Webhooks** | HMAC-SHA256 signature verification → enqueue job → 200 OK | Store `X-GitHub-Delivery` header for dedup. Handle `ping`, `push`, `pull_request`, `installation` events. |
| **LLM Provider (OpenAI/Anthropic/Gemini)** | Structured output (JSON mode / response_schema) with retry + fallback | Token limits vary. Plan for 4K-128K output depending on model. Use response_schema (OpenAI) or tools/function calling for structured JSON. |
| **Object Storage (S3/R2/MinIO)** | Presigned URLs for report exports, clone archives | Not needed for MVP (store in DB JSON columns). Add when reports exceed 10MB or need PDF generation. |
| **Vector Store (pgvector / Qdrant)** | Embedding-based semantic search for finding similarity | Post-MVP. Not needed for initial evaluation pipeline. Add for cross-project comparison and recommendation search. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **API Gateway ↔ Worker** | BullMQ job queue (Redis) | Never direct. API produces jobs, workers consume. This is the critical decoupling point. |
| **Worker ↔ Pipeline Stages** | Direct function calls within worker process | Pipeline stages are in-process function calls, not separate services. This keeps latency low and simplifies error handling. Split to separate services only at very high scale (10k+ repos/day). |
| **Pipeline ↔ GitHub** | Octokit SDK (HTTP calls) | All GitHub API calls through a single client module for consistent caching and rate limiting. |
| **Pipeline ↔ Database** | Drizzle ORM (SQL over TCP) | All DB access through the ORM. No raw SQL except in migrations and RLS policies. |
| **Worker ↔ Dashboard (real-time)** | Redis Pub/Sub → Next.js API SSE endpoint | Worker publishes progress events to Redis channel. Dashboard API subscribes and forwards via SSE to client browsers. |
| **AI Agents ↔ LLM Provider** | OpenAI/Anthropic SDK (HTTPS) | Each agent has its own model configuration. Use a shared client with rate limiting to avoid 429 errors. |

## Build Order Implications

The architecture reveals a clear dependency chain:

```
Phase 1: Foundation
  - Database schema + multi-tenant setup
  - GitHub API client + caching layer
  - Basic project CRUD API

Phase 2: Async Pipeline
  - Job queue (BullMQ) setup
  - Pipeline runner (stages framework)
  - Stage 1: Repo fetching
  - Stage 2: Static analysis (deterministic)
  
Phase 3: AI Evaluation
  - LangGraph orchestrator
  - Individual AI agents (start with 1-2, expand)
  - Structured output schemas
  - Aggregator + scoring

Phase 4: Reporting
  - Report generator (JSON)
  - Scoring engine
  - Recommendation generation
  
Phase 5: Dashboard
  - Report viewer (interactive charts + findings)
  - Project management UI
  - Real-time status updates (SSE)

Phase 6: Polish
  - Webhook integration
  - Export (PDF/Markdown)
  - Advanced caching + rate limit optimization
  - Settings + team management
```

## Key Architectural Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **API + Frontend co-location** | Next.js 15+ App Router | Single deployable unit. API routes alongside frontend pages. SSR for report SEO. Shared TypeScript types. Avoids CORS issues. |
| **Job queue** | BullMQ (Node.js/Redis) | Native TypeScript, excellent state management, built-in rate limiting, Bull Board for monitoring. Matches Node.js ecosystem. |
| **Pipeline orchestration** | LangGraph (TypeScript) | First-class support for parallel execution + fan-in/fan-out. State management across stages. Built-in retry + error handling. |
| **Database** | PostgreSQL + Drizzle ORM | Type-safe SQL. Drizzle's schema definitions match TypeScript types better than Prisma for complex JSON fields. Better for multi-tenant RLS setup. |
| **Multi-tenancy** | Shared schema + tenant_id + RLS | Default for B2B SaaS. Lowest ops burden. Migrate paying enterprises to dedicated databases later if needed. |
| **LLM output structure** | Zod schemas with JSON mode | Validate every LLM response against a schema. Retry with modified prompt on malformed output. Prevents silent corruption of evaluation data. |
| **Report storage** | JSONB in PostgreSQL | Reports are inherently document-structured. JSONB allows querying into report fields when needed. Migrate to object storage if reports exceed 100MB. |

## Sources

- **CodeRabbit Architecture** (substack.com, 2026-06) — Async webhook + job queue + sandboxed analysis + multi-agent review + judge pattern
- **CodePulse Architecture** (github.com/Edge-Explorer/CodePulse, 2026-04) — Kafka-decoupled API/Worker, Postgres + KEDA auto-scaling
- **Screvyn Multi-Agent System** (github.com/Vatsalya2003/screvyn, 2026-03) — FastAPI + Celery + LangGraph + tree-sitter + 4 parallel agents
- **Anviksha Engineering** (github.com/ravigupta97/anviksha-engineering, 2026-05) — Parallel specialist agents + blind evaluator + conflict detection
- **CodeSentinel AI** (github.com/akashagalave/CodeSentinel-AI, 2026-03) — HMAC + LangGraph orchestrator + 3 parallel agents + RAG pipeline
- **Cursor System Design** (markaicode.com, 2026-05) — Event-driven microservices + Kafka + SSE streaming + tiered model ladder
- **GitHub Semantic Code** (ACM Queue, 2021) — Kafka → Indexer → Tagger → Query service on Kubernetes
- **Multi-Tenant Postgres in 2026** (toolchew.com, 2026-05) — Shared schema + RLS default, schema/DB-per-tenant for enterprise
- **BullMQ Production Architecture** (markaicode.com, 2026-05) — Job families, dedicated Redis cluster, KEDA scaling
- **Next.js SaaS Dashboard Patterns** (yashrajjain.in, 2026-04) — RSC + Client Components, Recharts for visualization

---
*Architecture research for: AI-Powered Code Analysis & Evaluation Platform*
*Researched: 2026-06-28*
