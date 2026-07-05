import type { AnalysisStatus } from "@/lib/api-analysis";

const STATUS_CONFIG: Record<
  AnalysisStatus,
  { label: string; style: string }
> = {
  pending: {
    label: "Not Analyzed",
    style: "bg-muted-foreground/15 text-muted-foreground",
  },
  queued: {
    label: "Queued",
    style: "bg-[#06B6D4]/15 text-[#06B6D4]",
  },
  analyzing_files: {
    label: "Analyzing",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  running_ruff: {
    label: "Linting",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  running_radon: {
    label: "Complexity",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  running_bandit: {
    label: "Security Scan",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  computing_importance: {
    label: "Scoring",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  computing_duplication: {
    label: "Duplication",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  aggregating: {
    label: "Aggregating",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  complete: {
    label: "Analyzed",
    style: "bg-[#10B981]/15 text-[#10B981]",
  },
  failed: {
    label: "Failed",
    style: "bg-[#EF4444]/15 text-[#EF4444]",
  },
};

export function AnalysisBadge({
  status,
}: {
  status: AnalysisStatus;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.style}`}
    >
      {config.label}
    </span>
  );
}
