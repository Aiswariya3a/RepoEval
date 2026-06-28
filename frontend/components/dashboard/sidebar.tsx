"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/app/auth-provider";

export function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const initials = user.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await logout();
    router.replace("/sign-in");
  };

  return (
    <aside className="w-64 h-screen border-r border-border flex flex-col p-4 bg-card">
      <div className="flex items-center gap-3 mb-6">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar_url || undefined} alt={user.display_name} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium truncate">{user.display_name}</span>
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

      <button
        onClick={handleSignOut}
        className="px-3 py-2 text-sm text-muted-foreground hover:underline text-left"
      >
        Sign out
      </button>
    </aside>
  );
}
