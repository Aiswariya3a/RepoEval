"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { createProject } from "@/lib/api-projects";
import type { ProjectCreate } from "@/lib/api-projects";

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
  const [customTag, setCustomTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleNameBlur() {
    setNameError(validateName(name));
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function addCustomTag() {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setCustomTag("");
  }

  function handleCustomTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomTag();
    }
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
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

            {/* Repo URLs field (decorative — deferred to Phase 3 per D-30) */}
            <div className="space-y-1.5">
              <label htmlFor="repo-urls" className="text-sm font-medium">
                Repository URLs
              </label>
              <input
                id="repo-urls"
                type="text"
                placeholder="https://github.com/owner/repo"
                disabled
                className="flex h-9 w-full rounded-lg border border-border bg-muted/50 px-3 py-1 text-sm shadow-sm text-muted-foreground cursor-not-allowed"
                title="Repo URLs will be available for setup in a future update"
              />
              <p className="text-xs text-muted-foreground">
                Repo URLs will be available for setup in a future update.
              </p>
            </div>

            {/* Tags field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>

              {/* Predefined tags */}
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      disabled={submitting}
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
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={handleCustomTagKeyDown}
                  placeholder="Add custom tag..."
                  disabled={submitting}
                  className="flex h-8 w-48 rounded-lg border border-border bg-background px-2.5 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={addCustomTag}
                  disabled={!customTag.trim() || submitting}
                  aria-label="Add custom tag"
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              {/* Selected tags display */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        disabled={submitting}
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
