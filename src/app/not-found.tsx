import Link from "next/link";
import { Home, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div
      data-theme="dark"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground"
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet to-accent-blue shadow-[0_0_40px_rgba(124,58,237,0.35)]">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-6xl font-semibold tracking-tight text-foreground-muted/40">
              404
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Page not found
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              This link doesn&apos;t exist or may have moved.
            </p>
          </div>
        </div>

        <Link href="/" className="inline-block">
          <Button variant="default" size="lg" className="gap-2">
            <Home className="h-4 w-4" />
            Back to workspace
          </Button>
        </Link>
      </div>
    </div>
  );
}
