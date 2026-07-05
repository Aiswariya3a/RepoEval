# Requirements: Project Intelligence & Evaluation Platform

**Defined:** 2026-06-28
**Core Value:** Automatically generate objective, rubric-based evaluation reports for any GitHub repository within minutes

## v1 Requirements

### Authentication & User Management

- [ ] **AUTH-01**: User can sign in with GitHub OAuth
- [x] **AUTH-02**: User can create and manage multiple projects
- [ ] **AUTH-03**: User can view a dashboard of all evaluated projects

### Repository Ingestion

- [x] **REPO-01**: User can ingest a GitHub repository by providing its URL (Phase 3)
- [x] **REPO-02**: System automatically detects repository language composition and tech stack (Phase 3)
- [ ] **REPO-03**: System handles large repositories with pagination and rate-limit awareness

### Static Code Analysis

- [ ] **SCA-01**: System runs static analysis on ingested repository code
- [ ] **SCA-02**: System generates code quality metrics (complexity, duplication, maintainability, lint issues)
- [ ] **SCA-03**: System produces a composite code quality score

### Repository Mining

- [ ] **MINE-01**: System analyzes commit history (frequency, author distribution, volume over time)
- [ ] **MINE-02**: System analyzes pull requests (cycle time, review count, merge rate, size distribution)
- [ ] **MINE-03**: System analyzes issues (open/close ratio, response time, resolution velocity)
- [ ] **MINE-04**: System generates basic contributor statistics

### AI Evaluation Engine

- [ ] **AIEE-01**: AI agents synthesize findings across all analysis dimensions into a coherent evaluation
- [ ] **AIEE-02**: System assesses code quality using AI-augmented analysis
- [ ] **AIEE-03**: System evaluates engineering maturity (CI/CD practices, code review culture, release discipline)
- [ ] **AIEE-04**: System analyzes documentation quality (README, inline docs, contribution guidelines)
- [ ] **AIEE-05**: System evaluates collaboration patterns and contributor performance
- [ ] **AIEE-06**: System assesses overall project health
- [ ] **AIEE-07**: System identifies project risks (bus factor, abandoned modules, security anti-patterns)
- [ ] **AIEE-08**: System identifies strengths and weaknesses with supporting evidence
- [ ] **AIEE-09**: System generates actionable prioritized recommendations
- [ ] **AIEE-10**: System uses customizable rubric-based scoring criteria
- [ ] **AIEE-11**: Every AI-generated claim cites specific source evidence (code lines, commits, PRs)

### Evaluation Reports

- [ ] **RPT-01**: System generates a comprehensive evaluation report with dimensional scores
- [ ] **RPT-02**: Report is displayed as an interactive web page with charts and narrative
- [ ] **RPT-03**: Report is exportable as PDF
- [ ] **RPT-04**: Report includes an AI-generated executive summary
- [ ] **RPT-05**: Report includes risk flags, strengths, weaknesses, and recommendations sections

## v2 Requirements

### Advanced Evaluation

- **CUST-01**: User can create and save custom evaluation rubrics with weighted criteria
- **CUST-02**: User can share rubrics with teams
- **CMPR-01**: User can compare multiple repositories against the same rubric
- **BATCH-01**: User can evaluate multiple repositories in batch
- **BATCH-02**: Batch evaluation produces ranked comparison view

### Enhanced Capabilities

- **EDUC-01**: System provides educational explanations for low scores with learning resources
- **MONTR-01**: System supports scheduled re-evaluation of repositories
- **MONTR-02**: System tracks project health trends over time
- **INT-01**: System delivers reports via Slack and email
- **INT-02**: System exposes API for third-party integrations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time continuous monitoring | High architecture complexity; periodic evaluation provides sufficient value for MVP |
| Individual developer productivity ranking | Creates toxic team dynamics; show team patterns, not individual rankings |
| Native CI/CD pipeline integration | Heavy integration effort across multiple CI systems; defer to post-MVP |
| On-premise/self-hosted deployment | SaaS-only for v1; operational overhead would consume engineering resources |
| Code generation / auto-fix | Blurs evaluation vs. engineering tool identity; creates liability |
| In-IDE plugin / extension | Premature before web platform is proven; maintain multiple extensions is costly |
| Gamification / badges | Trivializes evaluation; risks score-gaming behavior |
| Natural language "chat with repo" | Extremely complex LLM feature; not core to evaluation value proposition |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 9 | Pending |
| REPO-01 | Phase 3 | Pending |
| REPO-02 | Phase 3 | Pending |
| REPO-03 | Phase 3 | Pending |
| SCA-01 | Phase 4 | Pending |
| SCA-02 | Phase 4 | Pending |
| SCA-03 | Phase 4 | Pending |
| MINE-01 | Phase 5 | Pending |
| MINE-02 | Phase 5 | Pending |
| MINE-03 | Phase 5 | Pending |
| MINE-04 | Phase 5 | Pending |
| AIEE-01 | Phase 6 | Pending |
| AIEE-02 | Phase 7 | Pending |
| AIEE-03 | Phase 7 | Pending |
| AIEE-04 | Phase 7 | Pending |
| AIEE-05 | Phase 7 | Pending |
| AIEE-06 | Phase 7 | Pending |
| AIEE-07 | Phase 7 | Pending |
| AIEE-08 | Phase 7 | Pending |
| AIEE-09 | Phase 7 | Pending |
| AIEE-10 | Phase 6 | Pending |
| AIEE-11 | Phase 6 | Pending |
| RPT-01 | Phase 8 | Pending |
| RPT-02 | Phase 9 | Pending |
| RPT-03 | Phase 8 | Pending |
| RPT-04 | Phase 8 | Pending |
| RPT-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✅

---
*Requirements defined: 2026-06-28*
*Last updated: 2026-06-28 after initial definition*
