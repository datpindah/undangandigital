// ============================================================
// Edge Function: rsvp
// Deploy via: Supabase Dashboard > Edge Functions > New Function
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/rsvp\/?/, "").split("/").filter(Boolean);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // POST /rsvp — public
    if (req.method === "POST" && parts.length === 0) {
      const body = await req.json();
      const { invitation_id, guest_name, attendance, total_guest, message } = body;

      if (!invitation_id || !guest_name || !attendance) {
        return errorResponse("invitation_id, guest_name, dan attendance wajib diisi", 400);
      }
      if (!["hadir", "tidak", "ragu"].includes(attendance)) {
        return errorResponse("attendance harus: hadir, tidak, atau ragu", 400);
      }

      const { data: inv } = await supabaseAdmin
        .from("invitations").select("id").eq("id", invitation_id).single();
      if (!inv) return errorResponse("Invitation not found", 404);

      const { data, error } = await supabaseAdmin.from("rsvps").insert({
        invitation_id,
        guest_name: String(guest_name).trim().substring(0, 200),
        attendance,
        total_guest: Math.min(Math.max(parseInt(total_guest) || 1, 1), 20),
        message: message ? String(message).trim().substring(0, 1000) : "",
      }).select().single();

      if (error) throw error;
      return jsonResponse({ message: "RSVP sent successfully", id: data.id }, 201);
    }

    // GET /rsvp/:invitation_id — protected
    if (req.method === "GET" && parts.length === 1) {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const { data: inv } = await supabase.from("invitations")
        .select("id").eq("id", parts[0]).eq("user_id", user.id).single();
      if (!inv) return errorResponse("Not found or not authorized", 404);

      const { data, error } = await supabase.from("rsvps")
        .select("*").eq("invitation_id", parts[0])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return jsonResponse(data);
    }

    return errorResponse("Not Found", 404);
  } catch (err) {
    console.error(err);
    return errorResponse("Server error", 500);
  }
});
