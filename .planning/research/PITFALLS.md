# Pitfalls Research

**Domain:** AI-powered Project Intelligence & Evaluation Platform
**Researched:** 2026-06-28
**Confidence:** HIGH (synthesized from industry research, academic papers, engineering post-mortems, and competitor analysis)

## Executive Summary

This document catalogs the critical mistakes and failure modes specific to building an AI-powered platform that analyzes GitHub repositories and generates evaluation reports. The research draws from 3,864 documented bugs in AI coding tools (York University/Concordia University, 2026), analysis of 7,703 AI-generated code files for security vulnerabilities (FernUniversität, 2025), six years of SAST integration post-mortems, and current best practices from platforms like Graphite, CodeAnt, GitGuardian, and Atlassian's RovoDev. The most dangerous pitfalls center on LLM hallucination in evaluation outputs (the platform's core value proposition), GitHub API integration fragility, false-positive pollution that destroys user trust, and rubric design that produces evaluations that are simultaneously too subjective and too rigid.

## Critical Pitfalls

### Pitfall 1: LLM Hallucination in Evaluation Outputs

**What goes wrong:**
The AI evaluation engine fabricates findings about code that don't exist — inventing bugs, security vulnerabilities, architectural issues, or quality metrics. The model produces fluent, plausible-sounding evaluations that are factually incorrect. This is the single most dangerous pitfall because the platform's core value proposition is automated evaluation, and hallucinated findings directly destroy credibility.

The York University/Concordia study of 3,864 bugs across Claude Code, Codex CLI, and Gemini CLI found that while "AI Logic & Behaviour" accounted for only 10% of bugs, those hallucinations had the highest user-facing impact — a single fabricated claim about code quality can get a PR rejected or a project flagged as risky when it isn't.

**Why it happens:**
LLMs are trained to produce plausible text, not truthful text. They optimize for fluency. In evaluation contexts, this manifests as:
- **Confirmation bias**: The model finds issues that match its training patterns even when absent
- **Metric fabrication**: Inventing code quality metrics or comparing against non-existent baselines
- **Architectural misinterpretation**: Misreading design patterns and flagging them incorrectly
- **Source citation hallucination**: Referencing files, lines, or commits that don't exist to support claims
- **Stakes amplification**: In high-stakes scenarios (security evaluation), the model over-identifies risks because training data overrepresents vulnerability patterns

Research shows prompt-based mitigation reduces GPT-4o hallucination rates from 53% to 23%, but this is still unacceptably high for production evaluation outputs.

**How to avoid:**
1. **Source-grounded evaluation architecture**: Every AI claim MUST link to specific source evidence (file path, line range, commit SHA, or metric output). Never allow free-text evaluation without citation. Adopt the "constrained extraction with mandatory source citation" pattern used in legal AI (Mage Legal, 2025).
2. **RAG with verified context**: Use Retrieval-Augmented Generation with the actual repository content as the knowledge base, not the model's training data. Chunk the repository and ground each evaluation claim in retrieved chunks.
3. **Multi-model validation**: Run evaluations through at least two different models and cross-reference findings. Disagreement triggers human review.
4. **Uncertainty quantification**: Train or prompt the model to output confidence scores for each finding. Findings below a confidence threshold are flagged or excluded.
5. **Fact-checking post-processing**: After generation, run each claim against the actual codebase programmatically where possible (e.g., if the AI says "this function has cyclomatic complexity > 15", actually measure it).
6. **"Don't know" as valid output**: Reward the model for abstaining when evidence is insufficient rather than fabricating.

**Warning signs:**
- Users report findings that "don't make sense" or reference code that doesn't exist
- Evaluation reports show suspiciously high issue counts for well-maintained repos
- Multiple evaluations of the same repo produce contradictory findings
- Support tickets about specific fabricated claims

**Phase to address:**
Core Architecture Phase (Phase 1). The hallucination prevention architecture must be built into the evaluation pipeline from day one. Retro-fitting source grounding is significantly harder than designing for it.

---

### Pitfall 2: GitHub API Rate Limiting & Data Fetching Collapse

**What goes wrong:**
The platform exhausts GitHub API rate limits during repository analysis, causing incomplete data collection, failed analyses, or artificial throttling that makes evaluation impossible for larger repos. The system either fails silently (producing partial evaluations) or crashes loudly (failing mid-analysis with no graceful degradation).

**Why it happens:**
GitHub's API limits are 5,000 requests/hour for authenticated users (REST) and 5,000 points/hour (GraphQL). A single thorough repository analysis can burn through this quickly:
- Repository metadata: 1-2 requests
- File listing + structure: 1-5 requests
- Commit history (paginated): N requests (100+ for large repos)
- PR and issue analysis: 10-100+ requests
- Contributor data: 1 request per contributor
- Branch/tag enumeration: 5-20 requests

For a repo with 10,000+ commits and 50+ contributors, a single analysis can exceed 200+ requests. The Search API is even more restrictive (30 req/min). Secondary rate limits (100 concurrent requests, 900 points/minute for write operations) compound the problem.

The 2026 analysis from GitHub API experts notes that "monitoring 200 repos + commit history exhausts your quota in minutes."

**How to avoid:**
1. **GraphQL over REST**: GraphQL allows fetching exactly the data needed in fewer requests. A single GraphQL query can replace 10+ REST calls. Use GraphQL's node-based querying to batch related data.
2. **Conditional requests with ETags**: Use `If-None-Match` headers. 304 responses don't count against rate limits. For repos analyzed periodically, this can reduce request volume by 60-80%.
3. **GitHub App architecture**: Use GitHub Apps (not personal tokens) for higher rate limits (5,000/hr + 50/repo for installations) and per-installation rate limit tracking.
4. **Webhook-based incremental data**: Instead of polling the API for every analysis, pre-warm a data cache using GitHub webhooks that push changes as they happen.
5. **Intelligent caching layer**: Cache all API responses with TTLs. Repo metadata changes slowly — cache for hours/days. Commit data can be cached with shorter TTLs.
6. **Graceful degradation**: When rate limited, the system should:
   - Return partial results with clear indicators of what's missing
   - Queue the remaining analysis for when limits reset
   - Never silently produce incomplete evaluations
7. **Secondary rate limit handling**: Implement exponential backoff with jitter, not naive retry.
8. **Pre-fetch budgeting**: Before starting analysis, estimate the request cost and check if sufficient quota exists.

**Warning signs:**
- 403/429 responses during development testing
- Analysis completes but has "filler" data for contributors, commits, or history
- Processing time grows non-linearly with repo size
- Users on free GitHub accounts report more failures than enterprise users

**Phase to address:**
Integration Phase (Phase 2). The API integration layer must be designed with rate limit awareness from the start. It cannot be bolted on after the data fetching code is written.

---

### Pitfall 3: False Positive Pollution Destroying User Trust

**What goes wrong:**
The combined output of static analysis tools and AI evaluation generates so many false positives that users can't distinguish real issues from noise. The evaluation report becomes a liability rather than a value-add — users ignore it entirely, miss real critical issues buried in the noise, and abandon the platform.

Traditional SAST tools exceed 50% false positive rates (ZeroPath, 2026). The AI layer often amplifies this: the study on "Reducing False Positives in Static Bug Detection with LLMs" (2025) found that while LLMs can help filter false positives, they also introduce their own false positives when given isolated code snippets without full context.

**Why it happens:**
- Static analysis tools are pattern-matching engines. They flag anything that looks like a vulnerability pattern, regardless of whether it's exploitable in context.
- AI evaluation models trained on generic codebases flag issues that are standard practice in specific frameworks or languages.
- The "better safe than sorry" bias in both tools and models leads to over-reporting.
- Without contextual understanding (is this input sanitized elsewhere? is this function only called from trusted contexts?), every potential issue looks real.
- Developers become desensitized: a 50% false positive rate means half of all findings are wrong, so trust in all findings degrades.

The engineering time spent triaging false positives often exceeds the time saved by automation. Graphite's approach of "high-signal, low-noise" is the gold standard that most competitors fail to achieve.

**How to avoid:**
1. **Multi-tool cross-validation**: Run findings through multiple analysis tools (static analysis + AI + rule-based checks) and only report findings that are corroborated by at least two sources.
2. **Context-aware filtering**: Provide the AI with surrounding code context, not just the flagged line. The 2025 study on LLMs for static bug detection found a 30-50% reduction in false positives when full function context was provided.
3. **Exploitability verification**: For security findings, verify whether the flagged issue is actually exploitable given the codebase context. A SQL injection in a function that's only called from an admin panel with proper auth may not be exploitable.
4. **User-configurable severity thresholds**: Let users set their own noise tolerance. Junior teams may want more findings; experienced teams may want only critical issues.
5. **Feedback loop**: Allow users to mark findings as "valid" or "false positive." Track accuracy per tool/model/category. Use this data to dynamically adjust confidence thresholds.
6. **False positive tracking dashboard**: Show users their false positive rate per category. Transparency about accuracy builds trust even when accuracy isn't perfect.
7. **Silent ranking**: Don't show low-confidence findings by default. Include them in an "expanded" view that's one click away.

**Warning signs:**
- Users report "evaluation fatigue" — stopping reading reports
- Low user return rate after first evaluation
- Support tickets about specific "wrong" findings
- Users asking to disable specific analysis categories

**Phase to address:**
Evaluation Engine Phase (Phase 3). False positive management is a core evaluation quality concern, not an afterthought.

---

### Pitfall 4: Rubric Design Failure — Too Subjective vs Too Rigid

**What goes wrong:**
The evaluation rubric produces assessments that are either:
- **Too subjective**: Vague criteria like "good code quality" or "strong architecture" that the AI interprets inconsistently across evaluations. Two evaluations of the same repo produce different results. Users can't tell what they're being scored on.
- **Too rigid**: Mechanistic criteria like "has 80% test coverage" or "uses TypeScript" that miss the actual quality picture. A repo with 80% coverage on trivial code scores higher than one with 60% coverage on complex, critical code.

The Snorkel AI rubric design research (2026) shows that rubric quality is the #1 predictor of evaluation reliability, yet most teams design rubrics as an afterthought. Encord's research (2025) identifies "lacking human oversight in rubric design" as one of the top 3 signs of a broken AI evaluation system.

**Why it happens:**
- Rubrics are created in isolation without stakeholder input
- Rubrics mirror what's easy to measure rather than what's meaningful
- Rubrics are static — they don't evolve as the platform or codebase matures
- Rubrics try to compress multi-dimensional quality into a single score
- There's no rubric validation before deployment — the first "real" evaluation is also the first test

**How to avoid:**
1. **Rubric design as engineering process**: Follow the Snorkel AI rubric design framework:
   - Define what "good" looks like operationally (not: "good documentation," but: "every public API has a docstring, README has installation/usage/API sections, changelog is maintained")
   - Design for multi-dimensional output, not a single score
   - Validate rubrics against hand-evaluated examples before shipping
   - Version rubrics so users know what criteria they were evaluated against
2. **Transparent, machine-readable criteria**: Rubric criteria must be explicit enough that both humans and AI interpret them the same way. "Well-structured code" → "Code is organized into directories by feature, no file exceeds 500 lines, functions have single responsibilities"
3. **Calibrate with human evaluators**: Before deploying a rubric, have domain experts evaluate 10-20 repos manually using the rubric, compare AI outputs, and calibrate.
4. **Score decomposition**: Never show a single "quality score." Decompose into dimension scores (code quality, documentation, collaboration, security, etc.) with independent rubrics.
5. **Rubric evolution cycle**: Rubrics should have a version lifecycle. Collect feedback, analyze disagreements between AI and user expectations, and update rubrics quarterly.
6. **Allow rubric customization**: Let users weight dimensions or add custom criteria. Different users (educators vs. engineering managers vs. maintainers) value different things.

**Warning signs:**
- Users ask "how was this score calculated?"
- The same repo gets meaningfully different scores in consecutive evaluations
- Users say the evaluation "doesn't reflect reality"
- Rubric documentation is a paragraph rather than a detailed spec

**Phase to address:**
Evaluation Engine Phase (Phase 3). Rubric design must happen in parallel with evaluation pipeline development, not after.

---

### Pitfall 5: Report Actionability Gap — "So What?" Problem

**What goes wrong:**
The platform generates comprehensive, beautiful evaluation reports that users read once, nod at, and then do nothing with. The report identifies issues but provides no actionable path to improvement. Users get a diagnosis without a prescription, which means the platform becomes a "nice to have" rather than a "must use."

The runloop.ai research on AI code evaluation (2025) emphasizes that evaluation without actionable remediation is entertainment, not engineering.

**Why it happens:**
- Reports focus on WHAT (score/grade) rather than WHY (specific root causes) and HOW (remediation steps)
- Findings are presented as static facts rather than actionable items with priority ordering
- Reports lack integration with the user's workflow (no PR comments, no issue creation, no CI integration)
- The "actionable recommendation" feature is treated as a nice-to-have rather than a core feature
- Teams optimize for report aesthetics (charts, graphs, layouts) over report utility

**How to avoid:**
1. **Remediation-first architecture**: Every finding MUST include a specific, actionable remediation recommendation. Not "your test coverage is low" but "Add tests for auth/login.ts (0% coverage) and payment/checkout.ts (12% coverage) — these handle critical business logic."
2. **Priority-ranked findings**: Order findings by impact and effort, not by severity alone. A medium-severity issue that takes 5 minutes to fix should be surfaced before a high-severity issue that requires a 3-month refactor.
3. **Workflow integration from day one**: The evaluation output should plug into existing workflows:
   - Generate GitHub issues with labels, assignees, and priorities
   - Comment on PRs with evaluation findings
   - Create Jira tickets or Linear issues
   - Post summaries to Slack/MS Teams
4. **"Fix this" paths**: For common issues, link directly to relevant documentation, best practices, or even suggested code changes.
5. **Track remediation**: Show users which findings have been addressed over time. "Last month we flagged 12 issues — 8 have been resolved." This creates a feedback loop and demonstrates value.
6. **Executive summary + technical deep-dive**: Separate the report into layers. C-level users get a 3-bullet summary. Engineers get line-level findings. Both layers must be actionable for their audience.
7. **Before/after comparisons**: When a user makes changes based on recommendations, show how the evaluation changes. This reinforces the value of action.

**Warning signs:**
- Users download reports but never return
- Low repeat evaluation rate for the same repository
- Users ask "what should I do about this?"
- Support requests focus on interpretation rather than action

**Phase to address:**
Post-MVP (Phase 4 — the actionability layer should be in the MVP spec as a core requirement, not deferred). If actionable recommendations are deferred, the MVP risks producing "interesting but useless" output.

---

### Pitfall 6: Repository Scale Performance Meltdown

**What goes wrong:**
The evaluation pipeline works well on small tutorial repos (5 files, 50 commits) but fails catastrophically on real-world repositories (5,000+ files, 50,000+ commits, 100+ contributors, monorepo structure). Analysis times balloon from minutes to hours. The system crashes due to memory exhaustion. Pagination from the GitHub API never terminates. Static analysis tools take hours to run.

**Why it happens:**
- Development testing uses small, clean repositories that don't reflect production scale
- No early investment in incremental/streaming analysis — everything is loaded into memory
- GitHub API pagination is handled naively (fetch all pages before processing)
- Static analysis tools are run on the entire codebase rather than using differential analysis
- No processing time budgets — the system tries to analyze everything exhaustively
- Git history analysis is O(n) where n = number of commits, without sampling strategies

The Monitorr/CodeClimate pattern shows that platforms handling 10,000+ repos daily use pre-computed data caches, differential analysis, and aggressive sampling — lessons that are hard to retrofit.

**How to avoid:**
1. **Design for scale from the start**: The architecture must assume the worst case (Linux kernel-sized repo) and degrade gracefully. Test with large repos before writing the first line of production code.
2. **Incremental/streaming processing**: Process data as it streams in, not after it's all loaded. Use Node.js streams or similar patterns for paginated API results.
3. **Differential analysis for re-evaluations**: When re-analyzing a repo, only process the delta (new commits, changed files). This is how Klocwork achieves fast CI integration.
4. **Smart sampling**: Not every commit needs analysis. Sample at meaningful intervals — every commit for the last 100, then monthly snapshots for older history.
5. **Timeout budgets with partial results**: Set a processing budget per repo size tier. If analysis exceeds the budget, return partial results with clear indicators of what was skipped and why.
6. **Parallel processing with rate-limit awareness**: Analyze files in parallel but respect GitHub API rate limits. Use a worker pool pattern.
7. **Monorepo detection**: Detect monorepos early and adjust the analysis strategy. Analyze individual packages/projects within the monorepo rather than treating it as one giant codebase.
8. **Static analysis tiering**: Run fast linters (ESLint, Pylint) on everything. Run deep analysis (SonarQube, CodeQL) on a sample or only on critical paths.

**Warning signs:**
- Analysis takes >10 minutes for repos under 1,000 files
- Memory usage grows linearly with repo size (no streaming)
- System crashes or OOM errors during testing
- Development is only tested against repos like "hello-world" or "todo-app"

**Phase to address:**
Architecture Phase (Phase 1) + Scaling Phase (Phase 5). The architecture must be designed for streaming/incremental processing from the start, even if full sampling strategies are deferred.

---

### Pitfall 7: Code Privacy & Data Leakage to LLM Providers

**What goes wrong:**
Proprietary source code from analyzed repositories is sent to third-party LLM providers (OpenAI, Anthropic, etc.) for evaluation. This code may be:
- Used for model training (depending on provider terms)
- Logged or persisted on provider infrastructure
- Exposed through prompt injection attacks
- Subject to data breaches on the provider side
- Re-discoverable through model inversion or extraction attacks

This creates legal liability (IP exposure, NDA violations, GDPR issues for code containing personal data) and erodes trust for enterprise users who view source code as their most valuable asset.

The 2025 analysis of 500 organizations found that 47% had not reviewed privacy implications before adopting their primary AI coding tool, and 23% later discovered data handling that violated internal policies or customer commitments (Snyk, 2025).

**Why it happens:**
- Platform teams treat LLM API calls like any other API call without considering data sensitivity
- Default LLM provider terms often allow training on API inputs (must opt out explicitly)
- No distinction between public repo analysis (lower privacy concern) and private repo analysis (higher concern)
- Developers are used to SaaS tools handling their code (GitHub, GitLab) and assume LLM providers have equivalent protections
- The "zero code retention" pattern (process in memory, immediately discard) is an architecture decision, not a configuration option

**How to avoid:**
1. **Explicit data handling policy**: For each LLM provider, document:
   - Do they train on API inputs? (Opt-in, opt-out, or never)
   - How long is data retained?
   - Is data encrypted at rest and in transit?
   - Do they offer SOC 2/ISO 27001 certifications?
   - Are there data processing agreements (DPAs) available?
2. **Zero code retention architecture**: Process code only in-memory. Never write code to disk, logs, or training datasets. Discard immediately after processing. This is the pattern used by Panto AI and Tabnine.
3. **Provider tiering by sensitivity**:
   - Public repos → Can use standard LLM APIs
   - Private repos → Use providers with opt-out training policies and DPAs
   - Enterprise/highly sensitive → Use self-hosted models (local LLMs)
4. **Prompt sanitization**: Strip identifying information (repo name, contributor names, URLs) from prompts sent to LLM providers. Send only the code content and evaluation criteria.
5. **Data masking for sensitive patterns**: Detect and mask potential secrets (API keys, tokens, credentials) before sending to LLM providers. GitHub Copilot's exclusion settings and .aiexclude patterns are reference implementations.
6. **User-facing transparency**: Show users exactly what data is sent to LLM providers and for how long it's retained. Let them choose their privacy tier.
7. **Local model option**: For maximum privacy, allow self-hosted evaluation using smaller open-source models (Llama, CodeLlama, DeepSeek-Coder). Accept that local evaluation may have different accuracy characteristics.

**Warning signs:**
- No documented privacy policy for LLM data handling
- Code is included in logging or telemetry
- Users from regulated industries (fintech, healthcare, defense) express concerns
- Provider terms change and the platform doesn't update its compliance

**Phase to address:**
Architecture Phase (Phase 1) — data handling architecture must be designed before any LLM integration code is written. This is not a Phase 2 concern.

---

### Pitfall 8: User Trust Erosion from Opaque Evaluations

**What goes wrong:**
The platform produces evaluations that users can't verify, challenge, or understand. The evaluation is a "black box" — the AI says the project has poor code quality, but the user has no way to see why or to argue with the assessment. This leads to:
- Users rejecting evaluations they disagree with (especially for projects they're proud of)
- Users gaming the system once they figure out what metrics matter
- No learning value — the evaluation doesn't help users improve
- Legal/liability concerns — if the platform says a project is "high risk" and that affects funding or hiring decisions, the opacity is a liability

The Microsoft FAccT 2024 study on trust in AI code generation tools found three critical challenges: building appropriate expectations, configuring AI tools, and validating AI suggestions. The last one is most relevant here — without validation mechanisms, trust degrades.

**Why it happens:**
- Evaluations are designed as "final answers" rather than "starting points for discussion"
- No transparency into how individual scores are calculated
- AI evaluation outputs are presented with unwarranted confidence (no uncertainty indicators)
- Users have no way to inspect the evidence behind findings
- The platform treats user pushback as noise rather than signal

**How to avoid:**
1. **Evidence-backed evaluations**: Every finding, score, or assessment MUST be backed by specific, inspectable evidence. Think "appellate trail" — the user should be able to click into any finding and trace it back to the source code, metric, or heuristic that produced it.
2. **Confidence indicators**: Show confidence alongside every finding. Not "Code quality: 7/10" but "Code quality: 7/10 (±1.5, based on 8 of 12 metrics passing thresholds)." Low-confidence findings should be visually distinct.
3. **Dispute mechanism**: Let users flag specific findings as incorrect. Make this a core feature, not a support channel. Track dispute rates per metric/model. Use disputes to improve evaluation accuracy.
4. **Explainable AI outputs**: For AI-generated findings, show the reasoning chain and the specific code evidence used. If the LLM says "this function has high cyclomatic complexity," show the actual complexity calculation.
5. **Calibration dashboard**: Show users how the platform's evaluations compare to known benchmarks or human evaluations. "Our evaluation of 500 open-source projects correlated 0.82 with manual expert reviews."
6. **Progressive disclosure**: Show the summary first, but make every element clickable/expandable to reveal the underlying reasoning, evidence, and calculation.
7. **Evaluation as conversation**: Design the report as a starting point for discussion, not a final verdict. Users should be able to adjust weights, exclude metrics, and see how evaluations change.

**Warning signs:**
- Users argue with evaluation results on social media or in support channels
- Perceived "unfair" evaluations for popular/successful projects
- Users ask "how is this calculated?" frequently
- Low NPS scores despite functional reliability

**Phase to address:**
UX Phase (Phase 4). Trust is a product concern, not a technical one. The evaluation output design must prioritize transparency and verifiability.

---

### Pitfall 9: Context Blindness — Evaluating Without Understanding

**What goes wrong:**
The AI evaluates code without understanding the project's specific context:
- A framework-specific pattern is flagged as "non-standard" because the model doesn't know the framework
- A deliberate architectural tradeoff (e.g., using `any` in TypeScript for integration code) is flagged as a code quality issue
- Generated code or vendored dependencies are evaluated as if the team wrote them
- Legacy code that the team is already planning to replace is flagged as current technical debt
- Polyglot repositories are evaluated with a single-language lens

This produces evaluations that are technically "correct" but contextually wrong — making the platform untrustworthy for teams with real-world engineering complexity.

Research from the 2025 AI code review study at Atlassian (RovoDev) found that engineers' primary complaint about AI code review was "lack of contextual awareness of our codebase."

**Why it happens:**
- AI models are trained on generic codebases and don't know project-specific conventions
- No project profile is built before evaluation (what framework, what standards, what constraints)
- All code is treated equally — no distinction between authored code, generated code, vendored dependencies, or config files
- The platform doesn't distinguish between intentional decisions and accidental problems
- Evaluation criteria are applied uniformly across all projects regardless of type, size, or maturity

**How to avoid:**
1. **Repository profiling phase**: Before any evaluation, analyze the repo to build a context profile:
   - Languages and frameworks detected
   - Build system and dependency manager
   - Code generation tools in use (is this code generated?)
   - Vendored vs. authored code boundaries
   - Architecture patterns (monorepo, microservices, etc.)
   - Project maturity (years active, release cadence)
2. **Context-adaptive rubrics**: Adjust evaluation criteria based on the repo profile. Don't apply monolith patterns to microservice repos. Don't expect the same documentation standards from a weekend project as from a production system.
3. **Vendored/generated code exclusion**: Automatically detect and exclude generated code, vendored dependencies, and third-party code from evaluation. Only evaluate code the team actually owns.
4. **Best practice calibration**: If the project uses a specific framework (Next.js, Django, Spring Boot), calibrate evaluation against that framework's best practices, not generic web development best practices.
5. **Changelog-aware assessment**: Check if issues the AI finds are already known or planned. If the team already has a ticket to refactor a module, don't flag it as "undiscovered technical debt."
6. **Polyglot support**: Evaluate each language in the repo with language-appropriate tools and criteria. Don't run JavaScript analysis on Python files.

**Warning signs:**
- Evaluations flagging framework boilerplate as "code smells"
- Reports complain about generated code quality as if the team wrote it
- Small/simple repos get similar scores to complex production systems
- Users from specific framework communities complain about framework-ignorant evaluations

**Phase to address:**
Evaluation Engine Phase (Phase 3). Context profiling must precede evaluation. They cannot be done independently.

---

### Pitfall 10: Evaluation Drift and Rubric Decay Over Time

**What goes wrong:**
The evaluation quality degrades over time even as the platform is "working." Rubrics and evaluation criteria become stale as the ecosystem evolves (new frameworks, new best practices, new security threats). Models are updated by providers and behave differently. Repos change significantly between evaluations. The platform's evaluations become increasingly disconnected from current engineering reality.

**Why it happens:**
- Rubrics are designed once and never revisited
- LLM provider model updates (GPT-4 → GPT-5, Claude 3 → Claude 4) change evaluation behavior without notice
- The platform doesn't track its own accuracy over time
- New best practices emerge (new security vulnerabilities, new language features) but evaluations still use old standards
- The same repo evaluated 6 months apart gets different scores even though nothing changed, because the model changed
- No automated regression testing for evaluation accuracy

Encord's research highlights this as one of the top 3 signs of a broken AI evaluation: "You're not tracking evaluation in production." Without continuous evaluation monitoring, drift goes undetected until users complain.

**How to avoid:**
1. **Rubric versioning and changelog**: Every rubric has a version. Users can see which rubric version was used for their evaluation. Rubric changes are documented and communicated.
2. **Automated regression testing**: Build a "golden dataset" of 20-50 repositories with known, human-verified evaluations. Run the evaluation pipeline against this dataset with every significant change and track accuracy metrics over time.
3. **Model monitoring and pinning**: Track which model version produced each evaluation. When models update, run the golden dataset against both old and new models to detect behavior changes. Consider pinning model versions for consistency.
4. **User-flagged discrepancies**: Track when users flag evaluations as incorrect. Analyze flagged evaluations quarterly to identify systematic drift.
5. **Periodic rubric reviews**: Schedule rubric reviews quarterly. Review against:
   - New language features (TypeScript 5.x, Python 3.13, etc.)
   - New security vulnerability categories (CVEs, OWASP Top 10 updates)
   - User feedback and dispute patterns
   - Engineering community consensus changes
6. **Repro evaluation snapshots**: When a user asks "what changed since my last evaluation?" run both evaluations with the same rubric version for fair comparison. Don't use the latest rubric for historical comparison.
7. **Drift dashboard**: Track metrics like average score per repo type, flag rate per finding category, and disagreement rate per model. Any significant change is investigated.

**Warning signs:**
- Average evaluation scores for repos of a certain type suddenly shift
- Users say "this project was rated well 6 months ago, why is it bad now?"
- Support tickets suddenly increase after a model provider update
- The golden dataset accuracy drops below a threshold

**Phase to address:**
Post-MVP (Phase 6 — maintenance and operations). But the golden dataset should be created in Phase 1, even if drift monitoring is automated later.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded rubric criteria in prompt | Fast iteration on evaluation prompts | Rubrics become unmaintainable, no versioning, can't A/B test | Never — use rubric definition files from day one |
| Single LLM provider dependency | One integration to manage | Vendor lock-in, no fallback if provider changes terms/pricing/availability | Only in MVP prototype; must abstract before production |
| No evaluation caching | Simpler code, always "fresh" results | Every evaluation costs API credits + time; re-evaluating unchanged repos is wasteful | Only for first 50 evaluations; build caching at 100+ |
| Monolithic evaluation pipeline | Simple to reason about | Can't optimize individual stages, can't parallelize, hard to debug | Prototype only — decompose before production |
| Sync-only analysis (no queues) | Faster initial development | Browser/request blocks during analysis; can't handle concurrent evaluations | Never for production — always use job queue |
| Raw LLM output as final report | Zero post-processing | Reports contain hallucinations, formatting issues, missing evidence | Risk acceptable only for prototype demos |
| Store full repo clone forever | Fast re-analysis | Massive storage costs, privacy liability, stale data | Never — use git data + cache, not full clones |
| Manual provider model selection | Simpler code | Can't use best model per task (cheap model for linting, expensive for architecture) | Acceptable in MVP, technical debt by Phase 3 |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub API (REST) | Using REST for everything, paginating naively | Use GraphQL for batched data; use cursors, not page numbers for pagination |
| GitHub API (auth) | Using personal tokens for initial development | Use GitHub App installation tokens from day one to test realistic rate limits |
| GitHub API (webhooks) | Polling instead of webhooks for data freshness | Use webhook push model + API fill-in for initial backfill; webhooks are free and real-time |
| LLM (OpenAI/Anthropic) | Sending full repo contents in one prompt | Chunk strategically; each evaluation dimension gets relevant context, not everything |
| LLM (prompting) | No structured output format | Always use JSON mode or function calling for parseable evaluation results |
| LLM (error handling) | Treating all errors as retryable | Distinguish between rate limits (retry), context length (reduce input), and model errors (different action) |
| Static analysis tools | Running all tools on all files | Use language detection first, then run only relevant tools |
| Static analysis (output) | Parsing unstructured text output | Use tools with structured output (SARIF, JSON) from the start |
| Git data fetching | Deep cloning entire repos | Use shallow clones + `--depth` for history analysis; clone specific refs, not all branches |
| Authentication for private repos | Storing tokens in plaintext | Use encrypted token storage; never log tokens; use short-lived tokens with rotation |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full repo clone for analysis | Slow start, disk exhaustion | Use GitHub API + shallow clone; only deep clone when absolutely needed | 100+ files / 5+ MB repo |
| All-files static analysis | Minutes per run, OOM errors | Use differential analysis (only changed files), sampling for large repos | 1,000+ files |
| Sequential processing pipeline | Linear scaling with stages | Use streaming pipeline with backpressure; process stages in parallel where possible | 10+ concurrent evaluations |
| No pagination limiting | API call explosion, rate limit hits | Set max pages per API resource; use sampling for deep history | 500+ commits or 50+ pages |
| In-memory data accumulation | Memory grows with repo size | Use streaming and chunking; write intermediate results to storage | 100+ MB repo data |
| Retry storms on rate limits | Cascade failures, all workers retry simultaneously | Use exponential backoff with jitter and coordinated retry with central rate limit tracking | 5+ concurrent analyses |
| Regex-only code analysis | 50%+ false positive rates, security misses | Combine regex with AST parsing, taint tracking, or AI filtering | Any scale (quality issue, not scale) |
| Single-thread LLM calls | Evaluation time = sum of all LLM calls | Parallelize independent evaluation dimensions; manage concurrency per provider limits | 3+ evaluation dimensions |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending code to LLM without sanitization | Proprietary code leaks, training data inclusion | Strip identifiers; implement zero-retention; document provider data handling |
| Storing raw GitHub tokens | Token theft → unauthorized repo access | Encrypt at rest; use short-lived tokens; implement token rotation |
| Logging API request/response bodies | Code exposure in logs | Never log code content; log only metadata (repo name, file count, duration, status) |
| No prompt injection defense | Attacker-controlled repo names/comments manipulate AI output | Sanitize all user/ repo input to evaluation context; validate output schema |
| Storing full clone data indefinitely | Storage breach exposes entire repos | Set data retention policies; delete clone data after evaluation; use streaming processing |
| GitHub App with excessive permissions | Breach grants write access to repos | Use minimal required permissions; prefer read-only tokens |
| Storing evaluation results insecurely | Report data exposes project weaknesses | Encrypt evaluation results; implement access control per project |
| No rate of change limits | Attacker repeatedly evaluates same repo to drain API/LLM budget | Implement rate limiting per user/repo; set daily evaluation quotas |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing a single "quality score" | Users fixate on the number, ignore nuance | Show multi-dimensional profile; never summarize a project to a single number |
| Overwhelming report length | Users don't read it | Progressive disclosure: 3-bullet executive summary, then expandable sections |
| No comparison context | "Is 7/10 good?" | Show distribution: "This repo scores in the 75th percentile of similar projects" |
| AI evaluation without source attribution | Users can't verify claims | Every finding links to specific code, line, or metric source |
| Inconsistent evaluation timing | Users compare stale vs. fresh results unfairly | Show evaluation timestamp prominently; version-stamp evaluation criteria used |
| Ignoring repo documentation | Users feel the evaluation misses project intent | Display project's own README/doco alongside evaluation for context |
| No remediation tracking | Evaluation is a one-time event, not a process | Show progress over time: "3 issues resolved since last evaluation" |
| Mobile-unfriendly report display | Users can't review on-the-go | Responsive report design; printable/PDF export |
| No collaborative evaluation | Teams can't discuss findings together | Shareable report links with comments; team workspaces |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Evaluation report generation**: Often missing actionable remediation steps — verify every finding has a specific "how to fix" recommendation, not just a "what's wrong" diagnosis.
- [ ] **GitHub API integration**: Often missing rate limit handling and graceful degradation — verify the system has been tested against repos that would exhaust the hourly quota.
- [ ] **AI evaluation engine**: Often missing hallucination guards — verify that every AI-generated finding links to specific source evidence. Free-text evaluation without citation is a red flag.
- [ ] **Static analysis integration**: Often missing false positive filtering — verify there's at least one layer of FP reduction (cross-referencing, context verification, or AI filtering).
- [ ] **Rubric system**: Often missing versioning and transparency — verify users can see what rubric version was used, what criteria were evaluated, and how scores were calculated.
- [ ] **Dashboard**: Often missing the "what changed since last time" view — verify users can compare evaluations over time.
- [ ] **User onboarding**: Often missing context about AI limitations — verify that new users see a disclaimer about AI evaluation caveats and how to interpret results.
- [ ] **Private repo support**: Often missing documented data handling for sensitive code — verify that private repo evaluation has documented privacy guarantees and provider data handling policies.
- [ ] **Report export**: Often missing machine-readable output — verify that evaluations can be exported as structured data (JSON, CSV, SARIF) for integration into other tools.
- [ ] **Performance**: Often only tested on small repos (under 100 files, under 500 commits) — verify testing includes repos with 5,000+ files and 50,000+ commits.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hallucinated findings in published report | MEDIUM | 1. Flag report as containing potential errors. 2. Re-run evaluation with hallucination guardrails. 3. Publish corrected report with changelog noting what changed. 4. Analyze root cause (model, prompt, chunking strategy). |
| Rate limit exhaustion mid-evaluation | LOW | 1. Save partial results with markers of incomplete sections. 2. Queue remaining analysis for when limits reset. 3. Notify user of partial completion with ETA for full results. |
| False positive flood in reports | MEDIUM | 1. Disable the offending tool/metric/model. 2. Re-run affected evaluations without it. 3. Retroactively adjust scores for affected users. 4. Improve filtering before re-enabling. |
| Rubric producing inconsistent scores | HIGH | 1. Pin the current rubric version. 2. Award users the higher of old vs. new score during transition. 3. Run A/B test on golden dataset to calibrate new rubric. 4. Communicate rubric changes clearly. |
| Model provider change breaks evaluations | HIGH | 1. Pin to previous model version if available. 2. Run golden dataset against new model to quantify behavior change. 3. Update prompts/guardrails for new model. 4. Re-run evaluations if behavior shift affected results. |
| Security incident (code exposure) | VERY HIGH | 1. Revoke all tokens and rotate credentials. 2. Identify exposure scope (which repos, which users). 3. Notify affected users per legal obligations. 4. Implement additional controls before re-enabling. 5. Third-party security audit. |
| Performance regression at scale | MEDIUM | 1. Implement per-repo analysis caps (time, requests, files). 2. Return partial results with clear indicators. 3. Optimize bottleneck (often GitHub pagination or static analysis). 4. Add horizontal scaling for processing workers. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| LLM Hallucination in Evaluation | Phase 1 (Architecture) — source grounding, RAG, citation enforcement | Golden dataset test: 50 repos with known, verified evaluations; AI outputs must match source evidence |
| GitHub API Rate Limiting | Phase 2 (Integration) — GraphQL, caching, GitHub App auth, rate limit budgeting | Stress test: analyze 50 repos concurrently; verify graceful degradation at limit |
| False Positive Pollution | Phase 3 (Evaluation Engine) — multi-tool verification, context filtering, feedback loop | Measure FP rate against hand-verified dataset; target <15% FP rate at launch |
| Rubric Design Failure | Phase 3 (Evaluation Engine) — rubric framework, validation process, multi-dimensional scoring | Consistency test: evaluate same repo 3x; scores should not vary more than 5% |
| Report Actionability Gap | Phase 4 (Product/UX) — remediation recommendations, workflow integration | User test: can a developer who receives a report take at least one specific action within 5 minutes? |
| Performance at Scale | Phase 1 (Architecture) — streaming, sampling, differential analysis | Benchmark test: evaluate a repo with 10K+ files, 50K+ commits; should complete within 15 minutes |
| Code Privacy & Data Leakage | Phase 1 (Architecture) — zero-retention, provider policy review, privacy tiers | Security audit: verify no code appears in logs, caches, or training data; verify provider DPAs |
| User Trust Erosion | Phase 4 (Product/UX) — evidence-backed reports, confidence indicators, dispute mechanism | User study: do users feel they understand and can verify the evaluation output? |
| Context Blindness | Phase 3 (Evaluation Engine) — repo profiling, context-adaptive rubrics | Evaluate a well-known framework project (e.g., Next.js, Django); verify evaluation uses framework-appropriate criteria |
| Evaluation Drift | Phase 6 (Ops/Maintenance) — golden dataset, regression testing, model pinning | Quarterly: run golden dataset; accuracy should not drop more than 2% between quarters |

## Sources

- **"Why AI-Powered Code Review Tools Fail: 7 Common Pitfalls"** (Ryz Labs, March 2026) — Documented overreliance on automation, lack of contextual awareness, and insufficient training data as primary failure modes. HIGH confidence (industry analysis with data).
- **"Engineering Pitfalls in AI Coding Tools: What 3,864 Bugs Reveal"** (York University / Concordia University, April 2026) — Empirical analysis showing API & Integration errors at 21.4%, Configuration at 15.9%, and AI Logic at only 10% of bugs. HIGH confidence (peer-reviewed empirical study).
- **"AI Evaluation Pitfalls That Cause AI Project Failures"** (FuseFy/iMerit, June 2026) — 96% of companies say human-in-the-loop is essential; full automation without human checkpoints degrades quality. HIGH confidence (industry survey data).
- **"Reducing False Positives in Static Bug Detection with LLMs"** (arXiv, 2025) — Combined static analysis + LLM filtering significantly outperforms either approach alone. MEDIUM confidence (academic preprint, not yet peer-reviewed).
- **"AI Data Security: Best Practices"** (CISA/NSA/FBI, May 2025) — Joint cybersecurity guidance for securing data used to train and operate AI systems. HIGH confidence (government guidance).
- **"Privacy Considerations When Using AI Coding Tools"** (Vibe Coder Blog, April 2026) — Documented the four exposure categories for code privacy and the 47% of organizations that hadn't reviewed privacy implications. MEDIUM confidence (industry analysis, single source).
- **"Data quality and rubrics: how to build trust in your models"** (Snorkel AI, February 2026) — Five-part series on rubric-based evaluation design and the science behind rubric creation. HIGH confidence (established AI evaluation platform's research).
- **"3 Signs Your AI Evaluation Is Broken"** (Encord, November 2025) — Identified lack of human oversight, no production tracking, and no continuous evaluation as primary failure indicators. HIGH confidence (AI evaluation platform's research).
- **"Investigating and Designing for Trust in AI-powered Code Generation Tools"** (Microsoft Research / FAccT 2024) — Identified three trust challenges: appropriate expectations, AI configuration, and validating AI suggestions. HIGH confidence (peer-reviewed academic paper).
- **"Is AI code review worth it?"** (Graphite.dev) — Documented the "high-signal, low-noise" approach prioritizing real bugs over stylistic issues. MEDIUM confidence (vendor content, but aligns with independent research).
- **"How Accurate Is AI Code Review in 2026?"** (CodeAnt.ai, June 2026) — Documented AI's blind spots in business logic flaws, authorization bypass, and race conditions. MEDIUM confidence (vendor research, aligned with academic findings).
- **"GitHub API Rate Limits in 2026: When Web Scraping Is the Better Choice"** (DEV.to, May 2026) — Real-world analysis of GitHub API rate limit exhaustion patterns. MEDIUM confidence (practitioner experience, no empirical study).
- **GitHub REST API Rate Limit Documentation** (GitHub Docs) — Official documentation confirming 5,000 req/hr authenticated, 60 req/hr unauthenticated, secondary limits. HIGH confidence (official documentation).
- **"Assessing AI Code Quality: 10 Critical Dimensions"** (Runloop.ai, February 2025) — Framework for evaluating AI-generated code quality across functional, security, and maintainability dimensions. MEDIUM confidence (industry framework).

---
*Pitfalls research for: AI-powered Project Intelligence & Evaluation Platform*
*Researched: 2026-06-28*
