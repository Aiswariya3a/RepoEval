import { Button } from "@/components/ui/button";

export function WelcomeEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center max-w-prose mx-auto">
      <h2 className="text-xl font-semibold mb-2">Welcome to RepoEval</h2>
      <p className="text-muted-foreground mb-6">
        Evaluate your first repository to get started.
      </p>
      <Button size="default">
        Create Project
      </Button>
    </div>
  );
}
