"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden />
      Sign out
    </Button>
  );
}
