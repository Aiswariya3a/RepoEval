"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { TagSelector } from "@/components/dashboard/tag-selector";
import { ReposField } from "@/components/repos/repos-field";
import type { RepoEntry } from "@/components/repos/repos-field";
import { createProject } from "@/lib/api-projects";
import type { ProjectCreate } from "@/lib/api-projects";

const NAME_REGEX = /^[a-zA-Z0-9 _-]+$/;

function validateName(name: string): string | null {
  if (!name) return "Project name is required.";
  if (name.length < 1) return "Project name must be at least 1 character.";
  if (name.length > 100) return "Project name must be 100 characters or fewer.";
  if (!NAME_REGEX.test(name))
    return "Name can only contain letters, numbers, spaces, dashes, and underscores.";
  return null;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [repoEntries, setRepoEntries] = useState<RepoEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleNameBlur() {
    setNameError(validateName(name));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validateName(name);
    if (validationError) {
      setNameError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload: ProjectCreate = {
        name: name.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(selectedTags.length > 0 && { tags: selectedTags }),
        repo_urls: repoEntries.map((r) => r.url),
      };
      const project = await createProject(payload);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create project. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up a new project for evaluation.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Name field */}
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
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
                aria-describedby={nameError ? "name-error" : undefined}
              />
              {nameError && (
                <p id="name-error" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            {/* Description field */}
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="description"
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
            <Link href="/projects">
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Project"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {error && (
        <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
