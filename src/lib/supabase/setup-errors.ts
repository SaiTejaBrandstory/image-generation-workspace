const SETUP_HINT =
  "Database tables are missing. In Supabase Dashboard → SQL Editor, run supabase/migrations/001_conversations_and_storage.sql and 002_generation_rounds.sql, then refresh and try again.";

export function isMissingDatabaseSetup(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("public.conversations") ||
    lower.includes("pgrst205") ||
    lower.includes("relation") && lower.includes("does not exist")
  );
}

export function formatSupabaseSetupError(message: string): string {
  if (isMissingDatabaseSetup(message)) return SETUP_HINT;
  return message;
}

export const SUPABASE_SQL_EDITOR_URL =
  "https://supabase.com/dashboard/project/yeavejohvunhjwxqxxtb/sql/new";
