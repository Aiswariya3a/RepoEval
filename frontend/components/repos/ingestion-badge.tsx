import type { IngestionStatus } from "@/lib/api-repos";

const STATUS_CONFIG: Record<
  IngestionStatus,
  { label: string; style: string }
> = {
  pending: {
    label: "Pending",
    style: "bg-muted-foreground/15 text-muted-foreground",
  },
  queued: {
    label: "Queued",
    style: "bg-[#06B6D4]/15 text-[#06B6D4]",
  },
  fetching_metadata: {
    label: "Fetching Metadata",
    style: "bg-[#06B6D4]/15 text-[#06B6D4]",
  },
  cloning: {
    label: "Cloning",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  analyzing: {
    label: "Analyzing",
    style: "bg-[#4F46E5]/15 text-[#4F46E5]",
  },
  complete: {
    label: "Complete",
    style: "bg-[#10B981]/15 text-[#10B981]",
  },
  failed: {
    label: "Failed",
    style: "bg-[#EF4444]/15 text-[#EF4444]",
  },
  paused: {
    label: "Paused",
    style: "bg-[#F59E0B]/15 text-[#F59E0B]",
  },
};

export function IngestionBadge({
  status,
}: {
  status: IngestionStatus;
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

export function getAggregateBadgeLabel(
  status: IngestionStatus
): string {
  // For project-card aggregate display (D-41 priority)
  switch (status) {
    case "queued":
    case "fetching_metadata":
    case "cloning":
    case "analyzing":
      return "In Progress";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    case "paused":
      return "Paused";
    default:
      return "Pending";
  }
}
