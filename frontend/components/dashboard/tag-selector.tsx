"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PREDEFINED_TAGS = [
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

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({
  selectedTags,
  onChange,
  disabled = false,
}: TagSelectorProps) {
  const [customTag, setCustomTag] = useState("");

  function toggleTag(tag: string) {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  }

  function addCustomTag() {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      onChange([...selectedTags, tag]);
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
    onChange(selectedTags.filter((t) => t !== tag));
  }

  return (
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
              disabled={disabled}
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
          disabled={disabled}
          className="flex h-8 w-48 rounded-lg border border-border bg-background px-2.5 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={addCustomTag}
          disabled={!customTag.trim() || disabled}
          aria-label="Add custom tag"
        >
          Add
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
                disabled={disabled}
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
  );
}
