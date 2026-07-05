"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isValidGithubUrl,
  parseGithubUrl,
  type IngestionStatus,
} from "@/lib/api-repos";

export interface RepoEntry {
  id?: string; // backend ID (null if not yet persisted)
  url: string;
  owner: string;
  name: string;
  full_name: string;
  ingestion_status?: IngestionStatus;
}

export function ReposField({
  repos,
  onChange,
  disabled = false,
}: {
  repos: RepoEntry[];
  onChange: (repos: RepoEntry[]) => void;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const url = inputValue.trim();

    // Validate URL format
    if (!isValidGithubUrl(url)) {
      setError(
        "Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)"
      );
      return;
    }

    const parsed = parseGithubUrl(url);
    if (!parsed) {
      setError("Could not parse repository owner and name from URL.");
      return;
    }

    const fullName = `${parsed.owner}/${parsed.name}`;

    // Check duplicate
    if (repos.some((r) => r.full_name === fullName)) {
      setError("This repository has already been added to this project.");
      return;
    }

    onChange([
      ...repos,
      {
        url,
        owner: parsed.owner,
        name: parsed.name,
        full_name: fullName,
        ingestion_status: "pending",
      },
    ]);
    setInputValue("");
    setError(null);
  }

  function handleRemove(fullName: string) {
    onChange(repos.filter((r) => r.full_name !== fullName));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Repository URLs</label>

      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="https://github.com/owner/repo"
          disabled={disabled}
          className={`flex h-9 w-full rounded-lg border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
            error
              ? "border-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20"
              : "border-border"
          }`}
          aria-invalid={!!error}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!inputValue.trim() || disabled}
          aria-label="Add Repository"
          className="shrink-0"
        >
          <Plus className="size-3.5 mr-1" />
          Add Repository
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive mt-1">{error}</p>
      )}

      {repos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {repos.map((repo) => (
            <span
              key={repo.full_name}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium"
            >
              <span className="font-mono">{repo.full_name}</span>
              <button
                type="button"
                onClick={() => handleRemove(repo.full_name)}
                disabled={disabled}
                className="size-3.5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                aria-label={`Remove ${repo.full_name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
