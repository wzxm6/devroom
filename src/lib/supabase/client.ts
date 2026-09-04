import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { supabaseConfig } from './config';

let client: SupabaseClient<Database> | null = null;

if (supabaseConfig.isConfigured) {
  client = createClient<Database>(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
} else {
  // Safe dummy initialization to avoid hard crashing at import time
  // The UI displays the SetupRequired component when !supabaseConfig.isConfigured
  client = createClient<Database>(
    'https://placeholder-devroom.supabase.co',
    'placeholder-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export const supabase = client as SupabaseClient<Database>;
