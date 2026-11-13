// Server-side Supabase client (service role – bypasses RLS). Never ship to the browser.
import { createClient } from '@supabase/supabase-js';

let client;
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('MISSING_SUPABASE_SERVICE_ROLE');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const appUrl = () => (process.env.URL || 'http://localhost:8888').replace(/\/$/, '');

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});
