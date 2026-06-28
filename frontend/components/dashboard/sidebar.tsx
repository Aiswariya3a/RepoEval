import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MOCK_USER = {
  display_name: "User",
  avatar_url: null,
};

export function Sidebar() {
  const initials = MOCK_USER.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-64 h-screen border-r border-border flex flex-col p-4 bg-card">
      <div className="flex items-center gap-3 mb-6">
        <Avatar className="h-8 w-8">
          <AvatarImage src={MOCK_USER.avatar_url || undefined} alt={MOCK_USER.display_name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{MOCK_USER.display_name}</span>
      </div>

      <nav className="flex-1 space-y-1">
        <Link
          href="/dashboard"
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md bg-accent text-accent-foreground font-medium"
        >
          Dashboard
        </Link>
        <span className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground cursor-not-allowed">
          Projects
        </span>
        <span className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md text-muted-foreground cursor-not-allowed">
          Settings
        </span>
      </nav>

      <Link
        href="/sign-in"
        className="px-3 py-2 text-sm text-muted-foreground hover:underline"
      >
        Sign out
      </Link>
    </aside>
  );
}
