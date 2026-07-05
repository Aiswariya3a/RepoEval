"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Calendar, GitBranch, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  getProject,
  updateProject,
  deleteProject,
  createProject,
} from "@/lib/api-projects";
import type { Project, ProjectUpdate } from "@/lib/api-projects";
import { DeleteProjectDialog } from "@/components/dashboard/delete-project-dialog";
import { ReposField } from "@/components/repos/repos-field";
import type { RepoEntry } from "@/components/repos/repos-field";
import { IngestionBadge } from "@/components/repos/ingestion-badge";
import { IngestButton } from "@/components/repos/ingest-button";
import {
  IngestionProgressPanel,
  IngestionProgressSkeleton,
} from "@/components/repos/ingestion-progress-panel";
import { useIngestionPolling } from "@/lib/use-ingestion-polling";
import {
  listProjectRepos,
  addProjectRepo,
  removeProjectRepo,
  triggerIngestion,
  retryIngestion,
} from "@/lib/api-repos";
import type { Repo } from "@/lib/api-repos";
import { triggerAnalysis, getAnalysisResults } from "@/lib/api-analysis";
import type { AnalysisStatus, CodeQualityReport } from "@/lib/api-analysis";
import { isAnalysisTerminal } from "@/lib/api-analysis";
import { AnalyzeButton } from "@/components/analysis/analyze-button";
import {
  AnalysisProgressPanel,
  AnalysisProgressSkeleton,
} from "@/components/analysis/analysis-progress-panel";
import { AnalysisResultsDisplay } from "@/components/analysis/analysis-results-display";
import { AnalysisBadge } from "@/components/analysis/analysis-badge";
import { useAnalysisPolling } from "@/lib/use-analysis-polling";

const PREDEFINED_TAGS = [
  "Frontend",
  "Backend",
  "Full Stack",
  "Mobile",
  "AI/ML",
  "Data Science",
  "DevOps",
  "Cloud",
  "Open Source",
  "Research",
  "Hackathon",
  "Capstone",
  "Enterprise",
  "Library",
  "API",
  "Microservices",
  "CLI",
  "Web Application",
] as const;

const NAME_REGEX = /^[a-zA-Z0-9 _-]+$/;

function validateName(name: string): string | null {
  if (!name) return "Project name is required.";
  if (name.length < 1) return "Project name must be at least 1 character.";
  if (name.length > 100)
    return "Project name must be 100 characters or fewer.";
  if (!NAME_REGEX.test(name))
    return "Name can only contain letters, numbers, spaces, dashes, and underscores.";
  return null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  // ── Data state ──────────────────────────────────────
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "settings">(
    "overview"
  );

  // ── Repo state ──────────────────────────────────────
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [repoEntries, setRepoEntries] = useState<RepoEntry[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  // ── Analysis state ────────────────────────────────────
  const [activeAnalysisRepoId, setActiveAnalysisRepoId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [analysisResults, setAnalysisResults] = useState<CodeQualityReport | null>(null);
  const [analysisPollingEnabled, setAnalysisPollingEnabled] = useState(false);

  // ── Menu state ──────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // ── Delete dialog state ─────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Settings form state ─────────────────────────────
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editCustomTag, setEditCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // ── Duplicating state ──────────────────────────────
  const [duplicating, setDuplicating] = useState(false);

  // ── Fetch project ──────────────────────────────────
  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(projectId);
      setProject(data);
      // Pre-fill edit form
      setEditName(data.name);
      setEditDescription(data.description ?? "");
      setEditTags(data.tags ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load project."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // ── Fetch repos ──────────────────────────────────────
  const fetchRepos = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await listProjectRepos(projectId);
      setRepos(data);
    } catch {
      // Repos endpoint may not be available yet
    } finally {
      setReposLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (project) {
      fetchRepos();
    }
  }, [project, fetchRepos]);

  // ── Set active repo for polling ──────────────────────
  useEffect(() => {
    const running = repos.find(
      (r) =>
        r.ingestion_status !== "complete" &&
        r.ingestion_status !== "failed" &&
        r.ingestion_status !== "pending"
    );
    setActiveRepoId(running?.id ?? null);
  }, [repos]);

  // ── Ingestion polling ────────────────────────────────
  const pollingState = useIngestionPolling(
    projectId,
    activeRepoId,
    activeRepoId !== null
  );

  // ── Analysis polling ───────────────────────────────
  const {
    status: polledAnalysisStatus,
    steps: analysisSteps,
    elapsedSeconds: analysisElapsed,
    error: analysisError,
    isLoading: analysisLoading,
    refetch: refetchAnalysis,
  } = useAnalysisPolling(
    projectId,
    activeAnalysisRepoId,
    analysisPollingEnabled
  );

  // ── Sync polling status → state + fetch results on completion ──
  useEffect(() => {
    if (polledAnalysisStatus) {
      setAnalysisStatus(polledAnalysisStatus);

      if (isAnalysisTerminal(polledAnalysisStatus)) {
        setAnalysisPollingEnabled(false);

        if (polledAnalysisStatus === "complete" && activeAnalysisRepoId) {
          getAnalysisResults(projectId, activeAnalysisRepoId)
            .then(setAnalysisResults)
            .catch(() => {});
        }
      }
    }
  }, [polledAnalysisStatus, projectId, activeAnalysisRepoId]);

  // ── Close menu on outside click ──────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // ── Edit form handlers ───────────────────────────────
  function toggleEditTag(tag: string) {
    setEditTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addEditCustomTag() {
    const tag = editCustomTag.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags((prev) => [...prev, tag]);
    }
    setEditCustomTag("");
  }

  function handleEditCustomTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addEditCustomTag();
    }
  }

  function removeEditTag(tag: string) {
    setEditTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    const validationError = validateName(editName);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload: ProjectUpdate = {
        name: editName.trim(),
        ...(editDescription.trim() && { description: editDescription.trim() }),
        ...(editTags.length > 0 && { tags: editTags }),
      };
      const updated = await updateProject(projectId, payload);
      setProject(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handler ──────────────────────────────────
  async function handleDelete() {
    await deleteProject(projectId);
    router.push("/dashboard?deleted=true");
  }

  // ── Duplicate handler ───────────────────────────────
  async function handleDuplicate() {
    if (!project || duplicating) return;
    setDuplicating(true);
    setMenuOpen(false);
    try {
      const newProject = await createProject({
        name: `${project.name} (copy)`,
        description: project.description ?? undefined,
        tags: project.tags ?? undefined,
      });
      router.push(`/projects/${newProject.id}`);
    } catch (err) {
      setDuplicating(false);
    }
  }

  // ── Analysis trigger ───────────────────────────────
  async function handleAnalyze(repoId: string) {
    setActiveAnalysisRepoId(repoId);
    setAnalysisStatus("queued");
    setAnalysisResults(null);
    setAnalysisPollingEnabled(true);
    try {
      await triggerAnalysis(projectId, repoId);
    } catch (err) {
      // Error handled by polling hook
    }
  }

  // ── Loading skeleton ────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl animate-pulse">
        <div className="mb-6 h-4 w-48 rounded bg-muted" />
        <div className="mb-4 h-8 w-64 rounded bg-muted" />
        <div className="mb-6 h-4 w-96 rounded bg-muted" />
        <div className="flex gap-6 border-b border-border mb-6">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-8 w-24 rounded bg-muted" />
        </div>
        <div className="space-y-4">
          <div className="h-24 w-full rounded-xl bg-muted" />
          <div className="h-12 w-3/4 rounded-xl bg-muted" />
          <div className="h-12 w-1/2 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────
  if (error || !project) {
    return (
      <div className="mx-auto max-w-3xl text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {error || "The project you are looking for does not exist."}
        </p>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Breadcrumbs ─────────────────────────────── */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">{project.name}</span>
      </nav>

      {/* ── Header Section ──────────────────────────── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              Created {formatDate(project.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="size-3.5" />
              {repos.length} {repos.length === 1 ? "repo" : "repos"}
            </span>
          </div>
        </div>

        {/* Three-dot menu */}
        <div className="relative">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon-sm"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Project actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card py-1 shadow-lg ring-1 ring-foreground/10"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push(`/projects/${project.id}/edit`);
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="flex w-full items-center px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                {duplicating ? "Duplicating..." : "Duplicate"}
              </button>
              <hr className="my-1 border-border" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteDialogOpen(true);
                }}
                className="flex w-full items-center px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "overview"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "settings"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Settings
        </button>
      </div>

      {/* ── Overview Tab ────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* ── Repositories Section ─────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Repositories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Repo URL input for adding repos */}
              <ReposField repos={repoEntries} onChange={setRepoEntries} />

              {/* Add button */}
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  for (const entry of repoEntries) {
                    if (!entry.id) {
                      try {
                        await addProjectRepo(projectId, entry.url);
                      } catch {
                        /* ignore duplicates */
                      }
                    }
                  }
                  setRepoEntries([]);
                  await fetchRepos();
                }}
                disabled={repoEntries.filter((r) => !r.id).length === 0}
              >
                Add to Project
              </Button>

              {/* Repo list */}
              {reposLoading ? (
                <IngestionProgressSkeleton />
              ) : repos.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No repositories added yet.
                  <br />
                  Add a GitHub repository URL to start evaluating your project.
                </p>
              ) : (
                <div className="space-y-3">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className="rounded-lg border border-border p-4"
                    >
                      {/* Repo header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{repo.full_name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-md">
                            {repo.url}
                          </p>
                        </div>
                        {repo.language_percentages && (
                          <div className="text-xs text-muted-foreground text-right">
                            {Object.entries(repo.language_percentages)
                              .slice(0, 3)
                              .map(([lang, pct]) => `${lang} ${pct}%`)
                              .join(", ")}
                          </div>
                        )}
                      </div>

                      {/* Status row */}
                      <div className="flex items-center gap-2 mt-2">
                        <IngestionBadge status={repo.ingestion_status} />
                        {activeAnalysisRepoId === repo.id && analysisStatus && (
                          <AnalysisBadge status={analysisStatus} />
                        )}
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-2 mt-3">
                        <IngestButton
                          repoId={repo.id}
                          status={repo.ingestion_status}
                          onIngest={async () => {
                            if (
                              repo.ingestion_status === "failed" ||
                              repo.ingestion_status === "paused"
                            ) {
                              await retryIngestion(projectId, repo.id);
                            } else {
                              await triggerIngestion(projectId, repo.id);
                            }
                            await fetchRepos();
                          }}
                          disabled={activeRepoId !== null && activeRepoId !== repo.id}
                        />

                        {/* Remove button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await removeProjectRepo(projectId, repo.id);
                            await fetchRepos();
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </Button>
                      </div>

                      {/* Progress panel for active/completed/failed repos */}
                      {activeRepoId === repo.id && (
                        <IngestionProgressPanel
                          repoName={repo.full_name}
                          status={pollingState.status}
                          steps={pollingState.steps}
                          elapsedSeconds={pollingState.elapsedSeconds}
                          error={pollingState.error}
                        />
                      )}

                      {/* Analysis section — only when ingestion complete */}
                      {repo.ingestion_status === "complete" && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Code Analysis
                            </span>
                            {activeAnalysisRepoId === repo.id && analysisStatus && (
                              <AnalysisBadge status={analysisStatus} />
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <AnalyzeButton
                              repoId={repo.id}
                              status={activeAnalysisRepoId === repo.id ? analysisStatus : null}
                              onAnalyze={handleAnalyze}
                              disabled={activeAnalysisRepoId !== null && activeAnalysisRepoId !== repo.id}
                            />
                          </div>

                          {activeAnalysisRepoId === repo.id && analysisPollingEnabled && polledAnalysisStatus && !isAnalysisTerminal(polledAnalysisStatus) && (
                            <AnalysisProgressPanel
                              repoName={repo.full_name}
                              status={polledAnalysisStatus}
                              steps={analysisSteps}
                              elapsedSeconds={analysisElapsed}
                              error={analysisError}
                            />
                          )}

                          {activeAnalysisRepoId === repo.id && analysisResults && (
                            <div className="mt-3">
                              <AnalysisResultsDisplay
                                report={analysisResults}
                                onReAnalyze={() => handleAnalyze(repo.id)}
                                isAnalyzing={analysisPollingEnabled}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {project.description ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {project.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {project.tags && project.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No tags</p>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDateTime(project.created_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{formatDateTime(project.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Project ID</span>
                <span className="font-mono text-xs">{project.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Settings Tab ────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="space-y-8">
          {/* Inline Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle>Edit Project</CardTitle>
            </CardHeader>
            <form onSubmit={handleSave} noValidate>
              <CardContent className="space-y-5">
                {/* Success feedback */}
                {saveSuccess && (
                  <div className="rounded-md bg-primary/10 border border-primary/20 p-3 text-sm text-primary">
                    Changes saved successfully.
                  </div>
                )}

                {/* Error feedback */}
                {saveError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {saveError}
                  </div>
                )}

                {/* Name field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-name"
                    className="text-sm font-medium"
                  >
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="settings-name"
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (nameError) setNameError(null);
                      if (saveSuccess) setSaveSuccess(false);
                    }}
                    onBlur={() => setNameError(validateName(editName))}
                    placeholder="My Project"
                    maxLength={100}
                    disabled={saving}
                    className={`flex h-9 w-full rounded-lg border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
                      nameError
                        ? "border-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20"
                        : "border-border"
                    }`}
                    aria-invalid={!!nameError}
                    aria-describedby={
                      nameError ? "settings-name-error" : undefined
                    }
                  />
                  {nameError && (
                    <p
                      id="settings-name-error"
                      className="text-xs text-destructive"
                    >
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Description field */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="settings-description"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="settings-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="A brief description of your project..."
                    rows={3}
                    disabled={saving}
                    className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-y min-h-[60px]"
                  />
                </div>

                {/* Tags field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>

                  {/* Predefined tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {PREDEFINED_TAGS.map((tag) => {
                      const isSelected = editTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleEditTag(tag)}
                          disabled={saving}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          } disabled:opacity-50`}
                        >
                          {tag}
                          {isSelected && <X className="size-3" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tag input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCustomTag}
                      onChange={(e) => setEditCustomTag(e.target.value)}
                      onKeyDown={handleEditCustomTagKeyDown}
                      placeholder="Add custom tag..."
                      disabled={saving}
                      className="flex h-8 w-48 rounded-lg border border-border bg-background px-2.5 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={addEditCustomTag}
                      disabled={!editCustomTag.trim() || saving}
                      aria-label="Add custom tag"
                    >
                      Add
                    </Button>
                  </div>

                  {/* Selected tags display */}
                  {editTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {editTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeEditTag(tag)}
                            disabled={saving}
                            className="hover:text-destructive transition-colors disabled:opacity-50"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // Reset form to current project state
                    setEditName(project.name);
                    setEditDescription(project.description ?? "");
                    setEditTags(project.tags ?? []);
                    setSaveError(null);
                    setSaveSuccess(false);
                    setNameError(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Danger Zone / Delete Zone */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete a project, there is no going back. Please be
                certain.
              </p>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete Project
              </Button>
            </CardContent>
          </Card>

          {/* Delete Dialog */}
          <DeleteProjectDialog
            projectName={project.name}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
