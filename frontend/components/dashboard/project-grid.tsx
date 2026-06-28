"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { SkeletonCard } from "@/components/dashboard/skeleton-card";
import { listProjects } from "@/lib/api-projects";
import type { PaginatedResponse } from "@/lib/api-projects";
import type { Project } from "@/lib/api-projects";

const PAGE_SIZE = 12;
const SKELETON_COUNT = 6;

export function ProjectGrid({
  emptyFallback,
}: {
  emptyFallback?: React.ReactNode;
}) {
  const [data, setData] = useState<PaginatedResponse<Project> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      setLoading(true);
      try {
        const result = await listProjects(page, PAGE_SIZE);
        if (!cancelled) {
          setData(result);
        }
      } catch {
        // Keep previous data on error, or show empty state
        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, [page]);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (!data || data.items.length === 0) {
    return <>{emptyFallback}</>;
  }

  // Loaded state
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {data.items.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>

          {Array.from({ length: data.total_pages }, (_, i) => i + 1).map(
            (pageNum) => (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="icon"
                onClick={() => setPage(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={pageNum === page ? "page" : undefined}
              >
                {pageNum}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="icon"
            disabled={page >= data.total_pages}
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
