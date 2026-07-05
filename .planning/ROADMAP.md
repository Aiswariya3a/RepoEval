# Roadmap: AI-Powered Project Intelligence & Evaluation Platform

## Overview

Build an AI-powered platform that ingests GitHub repositories, runs static analysis and repository mining, then uses multi-agent AI evaluation to produce comprehensive, rubric-based assessment reports. The journey spans 9 phases: starting with authentication and project management, building the core analysis pipeline (ingestion → static analysis → repository mining), adding the AI evaluation engine with source-grounded evidence, generating interactive reports, and finally delivering a polished dashboard experience. Each phase delivers a coherent, verifiable capability that builds on the previous.

## Phases

- [ ] **Phase 1: Foundation & Authentication** - GitHub OAuth sign-in, project scaffolding, database schema, and deployment infrastructure
- [x] **Phase 2: Project Management** - Create, view, edit, and delete evaluation projects (completed 2026-07-05)
- [ ] **Phase 3: GitHub Integration & Repository Ingestion** - Ingest GitHub repos with language detection and large-repo handling (3/4 plans complete)
- [ ] **Phase 4: Static Code Analysis Pipeline** - Run static analysis tools to produce code quality metrics and composite scores
- [ ] **Phase 5: Repository Mining Pipeline** - Analyze commit history, PRs, issues, and contributor statistics
- [ ] **Phase 6: AI Evaluation Framework** - Build the agent orchestration architecture with source grounding and rubric scoring
- [ ] **Phase 7: AI Assessment Dimensions** - Implement all six evaluation dimensions with evidence-cited assessments
- [ ] **Phase 8: Report Generation & Export** - Generate comprehensive reports with PDF export
- [ ] **Phase 9: Interactive Dashboard & Reports** - Dashboard overview and interactive web reports with charts

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: Users can securely access the platform and the foundational architecture is in place
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01
**Success Criteria** (what must be TRUE):
  1. User can sign in to the platform using their GitHub account via OAuth
  2. User can sign out of the platform
  3. User's session persists across page reloads and browser restarts
  4. User is redirected back to the application after successful GitHub OAuth authorization
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [ ] 01-01-PLAN.md — Backend Foundation + Docker + Database Schema
- [ ] 01-02-PLAN.md — Frontend Foundation + shadcn/ui + Sign-In Page + Dashboard Shell
- [ ] 01-03-PLAN.md — JWT Service + Auth Middleware + GitHub OAuth Endpoints
- [ ] 01-04-PLAN.md — Frontend Auth Wiring + Session Management + Real User Data

### Phase 2: Project Management ✅ Complete (2026-07-05)
**Goal**: Users can create and manage their evaluation projects
**Depends on**: Phase 1
**Requirements**: AUTH-02
**Success Criteria** (what must be TRUE):
   1. Authenticated user can create a new project with name and description
   2. User can view a list of all their projects
   3. User can edit project name and description
   4. User can delete a project
   5. Each user sees only their own projects (data isolation)
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — Backend: Project CRUD API (tag migration, schemas, 5 endpoints) ✅ Complete
- [x] 02-02-PLAN.md — Frontend: Project List & Create (cards, grid, create form, sidebar update)
- [x] 02-03-PLAN.md — Frontend: Project Detail & Edit & Delete (detail tabs, edit form, delete dialog) ✅ Complete

### Phase 3: GitHub Integration & Repository Ingestion
**Goal**: Users can ingest GitHub repositories into projects for evaluation
**Depends on**: Phase 2
**Requirements**: REPO-01, REPO-02, REPO-03
**Success Criteria** (what must be TRUE):
  1. User can provide a GitHub repository URL and trigger ingestion into a project
  2. System automatically detects and displays the repository's language composition and tech stack
  3. User can see ingestion status (queued, cloning, analyzing, complete, or error)
  4. System successfully ingests large repositories (10,000+ commits, 5,000+ files) with pagination and rate-limit awareness
  5. Ingestion completes within minutes for typical repositories (< 5,000 commits, < 500 files)
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Backend: Repo Data Model, Migration & API Endpoints ✅ Complete
- [x] 03-02-PLAN.md — Backend: Ingestion Pipeline with Celery, Clone & Checkpoint Recovery ✅ Complete
- [x] 03-03-PLAN.md — Frontend: Repo UI Components (badge, progress panel, form field, hook) ✅ Complete
- [ ] 03-04-PLAN.md — Frontend: Integration into Forms, Detail Page & Project Cards

### Phase 4: Static Code Analysis Pipeline
**Goal**: System produces deterministic code quality metrics from ingested repository code
**Depends on**: Phase 3
**Requirements**: SCA-01, SCA-02, SCA-03
**Success Criteria** (what must be TRUE):
  1. System runs static analysis on all major languages detected in the repository
  2. User can view code quality metrics: complexity scores, duplication percentage, maintainability index, and lint issue counts
  3. System produces a composite code quality score for the repository
  4. Analysis results are available per-language and aggregated across the codebase
**Plans**: TBD
**UI hint**: yes

### Phase 5: Repository Mining Pipeline
**Goal**: System extracts and surfaces historical project data from commits, PRs, and issues
**Depends on**: Phase 3
**Requirements**: MINE-01, MINE-02, MINE-03, MINE-04
**Success Criteria** (what must be TRUE):
  1. User can view commit history analysis including frequency, author distribution, and volume over time
  2. User can view pull request analytics including cycle time, review count, merge rate, and size distribution
  3. User can view issue analytics including open/close ratio, response time, and resolution velocity
  4. User can view basic contributor statistics including unique contributors and contribution distribution
**Plans**: TBD
**UI hint**: yes

### Phase 6: AI Evaluation Framework
**Goal**: System has the AI orchestration architecture to synthesize all analysis data into coherent evaluations
**Depends on**: Phase 4, Phase 5
**Requirements**: AIEE-01, AIEE-10, AIEE-11
**Success Criteria** (what must be TRUE):
  1. AI system loads and processes outputs from both static analysis and repository mining as context
  2. Every AI-generated claim in evaluation output cites specific source evidence (file path, line range, commit SHA, PR number)
  3. System applies the default rubric criteria to score each evaluation dimension
  4. Parallel AI agents run concurrently and their outputs are aggregated into a unified evaluation via fan-in
**Plans**: TBD

### Phase 7: AI Assessment Dimensions
**Goal**: System evaluates projects across all six assessment dimensions with evidence-supported findings
**Depends on**: Phase 6
**Requirements**: AIEE-02, AIEE-03, AIEE-04, AIEE-05, AIEE-06, AIEE-07, AIEE-08, AIEE-09
**Success Criteria** (what must be TRUE):
  1. System generates an AI-augmented code quality assessment with specific evidence from static analysis
  2. System evaluates engineering maturity (CI/CD practices, code review culture, release discipline) with supporting evidence
  3. System analyzes documentation quality with specific references to README, inline documentation, and contribution guidelines
  4. System evaluates collaboration patterns and contributor performance with evidence from PR and commit data
  5. System identifies project risks (bus factor, abandoned modules, security anti-patterns) with supporting evidence
  6. System generates actionable, prioritized recommendations specific to the repository
**Plans**: TBD

### Phase 8: Report Generation & Export
**Goal**: System generates comprehensive evaluation reports with dimensional scores, narrative, and PDF export
**Depends on**: Phase 7
**Requirements**: RPT-01, RPT-03, RPT-04, RPT-05
**Success Criteria** (what must be TRUE):
  1. User can view a comprehensive evaluation report with dimensional scores for their evaluated project
  2. Report includes an AI-generated executive summary of the project
  3. Report includes dedicated sections for risk flags, strengths, weaknesses, and recommendations
  4. User can download the evaluation report as a PDF
**Plans**: TBD
**UI hint**: yes

### Phase 9: Interactive Dashboard & Reports
**Goal**: Users can manage all projects from a dashboard and interact with evaluation reports through rich visualizations
**Depends on**: Phase 8, Phase 2
**Requirements**: RPT-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can view a dashboard showing all their evaluated projects with summary metrics and evaluation status
  2. Report is displayed as an interactive web page with charts, narrative sections, and expandable evidence citations
  3. User can navigate between projects and their evaluation reports from the dashboard
  4. User can see evaluation scores and status at a glance on the dashboard without opening individual reports
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 4/4 | ✅ Complete | 2026-06-28 |
| 2. Project Management | 3/3 | Complete   | 2026-07-05 |
| 3. GitHub Integration & Repository Ingestion | 3/4 | In Progress|  |
| 4. Static Code Analysis Pipeline | 0/0 | Not started | - |
| 5. Repository Mining Pipeline | 0/0 | Not started | - |
| 6. AI Evaluation Framework | 0/0 | Not started | - |
| 7. AI Assessment Dimensions | 0/0 | Not started | - |
| 8. Report Generation & Export | 0/0 | Not started | - |
| 9. Interactive Dashboard & Reports | 0/0 | Not started | - |
