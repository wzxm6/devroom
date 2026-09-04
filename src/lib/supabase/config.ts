export interface SupabaseEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
  isDemoMode: boolean;
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const rawDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

// Validate URL format and non-empty key
const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const supabaseConfig: SupabaseEnvConfig = {
  supabaseUrl: rawUrl,
  supabaseAnonKey: rawAnonKey,
  isConfigured: Boolean(rawUrl && rawAnonKey && isValidUrl(rawUrl)),
  isDemoMode: rawDemoMode,
};
