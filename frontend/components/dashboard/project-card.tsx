import Link from "next/link";
import { Calendar, GitBranch, MoreHorizontal } from "lucide-react";

import { Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IngestionBadge, getAggregateBadgeLabel } from "@/components/repos/ingestion-badge";
import type { Project } from "@/lib/api-projects";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                // Full dropdown menu wired in 02-03
              }}
              aria-label="Project actions"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </CardAction>
        </CardHeader>

        {project.description && (
          <CardContent>
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          </CardContent>
        )}

        <CardFooter>
          <div className="flex items-center gap-4 text-xs text-muted-foreground w-full">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(project.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="size-3.5" />
              {project.repo_count} {project.repo_count === 1 ? "repo" : "repos"}
            </span>
            {project.repo_count > 0 && project.ingestion_status && (
              <span className="ml-auto">
                <IngestionBadge
                  status={project.ingestion_status as any}
                />
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
