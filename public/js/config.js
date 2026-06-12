// ============================================================
// Supabase Configuration
// Nilai ini di-inject otomatis saat build di Cloudflare Pages
// via environment variables:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
// Untuk development lokal, ganti langsung di sini.
// Anon key aman untuk frontend (read-only, dilindungi RLS).
// JANGAN taruh service_role key di sini.
// ============================================================
const SUPABASE_URL = "https://yyuibmahnvmkplphacfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5dWlibWFobnZta3BscGhhY2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMjMwNzYsImV4cCI6MjA5Njc5OTA3Nn0.QvicvX_xVakdgJJitq0t80pXTMw5B2pHgJcohDbRUZY";

// Edge Function base URL
const API_URL = `${SUPABASE_URL}/functions/v1`;
