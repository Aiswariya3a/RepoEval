"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { TagSelector } from "@/components/dashboard/tag-selector";
import { ReposField } from "@/components/repos/repos-field";
import type { RepoEntry } from "@/components/repos/repos-field";
import { getProject, updateProject } from "@/lib/api-projects";
import type { ProjectUpdate } from "@/lib/api-projects";
import { listProjectRepos, addProjectRepo, removeProjectRepo } from "@/lib/api-repos";

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

export default function EditProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  // ── Data state ──────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");

  // ── Form state ──────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [repoEntries, setRepoEntries] = useState<RepoEntry[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // ── Fetch project data ──────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setReposLoading(true);
    setLoadError(null);
    getProject(projectId)
      .then((project) => {
        setProjectName(project.name);
        setName(project.name);
        setDescription(project.description ?? "");
        setSelectedTags(project.tags ?? []);
        // Fetch existing repos
        return listProjectRepos(projectId)
          .then((repos) => {
            setRepoEntries(
              repos.map((r) => ({
                id: r.id,
                url: r.url,
                owner: r.owner,
                name: r.name,
                full_name: r.full_name,
                ingestion_status: r.ingestion_status,
              }))
            );
          })
          .catch(() => {
            // Repos endpoint may not be available yet
          });
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load project."
        );
      })
      .finally(() => {
        setLoading(false);
        setReposLoading(false);
      });
  }, [projectId]);

  // ── Form handlers ──────────────────────────────────
  function handleNameBlur() {
    setNameError(validateName(name));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload: ProjectUpdate = {
        name: name.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(selectedTags.length > 0 && { tags: selectedTags }),
      };
      await updateProject(projectId, payload);

      // Sync repos: add new, remove deleted
      const existingRepos = await listProjectRepos(projectId);
      const existingUrls = new Set(existingRepos.map((r) => r.url));
      const newUrls = new Set(repoEntries.map((r) => r.url));

      // Remove repos user deleted
      for (const repo of existingRepos) {
        if (!newUrls.has(repo.url)) {
          await removeProjectRepo(projectId, repo.id);
        }
      }

      // Add repos user added
      for (const entry of repoEntries) {
        if (!existingUrls.has(entry.url)) {
          await addProjectRepo(projectId, entry.url);
        }
      }

      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save changes. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading skeleton ────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl animate-pulse">
        <div className="mb-6 h-4 w-48 rounded bg-muted" />
        <div className="mb-6 h-8 w-48 rounded bg-muted" />
        <div className="rounded-xl border border-border">
          <div className="p-6 space-y-5">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-full rounded-lg bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-20 w-full rounded-lg bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-full rounded-lg bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-16 rounded-full bg-muted"
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border p-6">
            <div className="h-8 w-20 rounded-lg bg-muted" />
            <div className="h-8 w-28 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
        <p className="text-sm text-muted-foreground mb-6">{loadError}</p>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Breadcrumbs ─────────────────────────────── */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <span className="mx-2">›</span>
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-foreground transition-colors"
        >
          {projectName}
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Edit</span>
      </nav>

      {/* ── Page heading ────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your project details.
        </p>
      </div>

      {/* ── Edit form ───────────────────────────────── */}
      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error feedback */}
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Name field */}
            <div className="space-y-1.5">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                onBlur={handleNameBlur}
                placeholder="My Project"
                maxLength={100}
                disabled={submitting}
                className={`flex h-9 w-full rounded-lg border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
                  nameError
                    ? "border-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20"
                    : "border-border"
                }`}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "edit-name-error" : undefined}
              />
              {nameError && (
                <p id="edit-name-error" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            {/* Description field */}
            <div className="space-y-1.5">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project..."
                rows={3}
                disabled={submitting}
                className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-y min-h-[60px]"
              />
            </div>

            {/* Repo URLs field */}
            <ReposField repos={repoEntries} onChange={setRepoEntries} disabled={submitting} />

            {/* Tags field */}
            <TagSelector
              selectedTags={selectedTags}
              onChange={setSelectedTags}
              disabled={submitting}
            />
          </CardContent>

          <CardFooter className="flex items-center justify-between">
            <Link href={`/projects/${projectId}`}>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
