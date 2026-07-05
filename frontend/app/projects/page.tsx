import { ProjectGrid } from "@/components/dashboard/project-grid";
import { WelcomeEmptyState } from "@/components/dashboard/welcome-empty-state";

export default function ProjectsPage() {
  return <ProjectGrid emptyFallback={<WelcomeEmptyState />} />;
}
