import { Sparkles } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next ?? "/";
  const authError = params.error;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-violet to-accent-blue shadow-[0_0_40px_rgba(124,58,237,0.35)]">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Brandwise</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Sign in to generate and save your layout workspaces
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-surface p-8 shadow-xl">
          <GoogleSignInButton next={next} />
          {authError && (
            <p className="mt-4 text-center text-sm text-red-400">
              Sign-in didn&apos;t work. Please try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
