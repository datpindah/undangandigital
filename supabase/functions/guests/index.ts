import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse, getUser } from "../_shared/utils.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/guests\/?/, "").split("/").filter(Boolean);
  // parts[0] = 'bulk' | invitation_id | guest_id

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  try {
    const user = await getUser(supabase);
    if (!user) return errorResponse("Unauthorized", 401);

    // -------------------------------------------------------
    // POST /guests/bulk — upload Excel
    // -------------------------------------------------------
    if (req.method === "POST" && parts[0] === "bulk") {
      const formData = await req.formData();
      const invitation_id = formData.get("invitation_id") as string | null;
      const file = formData.get("file") as File | null;

      if (!invitation_id || !file) {
        return errorResponse("invitation_id dan file Excel wajib diisi", 400);
      }

      // Verify ownership
      const { data: inv } = await supabase
        .from("invitations")
        .select("id")
        .eq("id", invitation_id)
        .eq("user_id", user.id)
        .single();

      if (!inv) return errorResponse("Invitation not found or not authorized", 404);

      // Parse CSV/Excel (Deno-compatible: read as text, parse CSV)
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      let addedCount = 0;
      const errors: string[] = [];

      for (const line of lines) {
        // Support CSV: take first column
        const guestName = line.split(",")[0].replace(/^["']|["']$/g, "").trim();
        if (!guestName) continue;

        const slug =
          guestName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") +
          "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

        const { error } = await supabase.from("guests").insert({
          invitation_id,
          guest_name: guestName,
          slug,
        });

        if (error) {
          errors.push(`Skipped: ${guestName} — ${error.message}`);
        } else {
          addedCount++;
        }
      }

      return jsonResponse({ message: `Berhasil menambahkan ${addedCount} tamu`, errors }, 201);
    }

    // -------------------------------------------------------
    // POST /guests — add single guest
    // -------------------------------------------------------
    if (req.method === "POST" && parts.length === 0) {
      const body = await req.json();
      const { invitation_id, guest_name, slug: customSlug } = body;

      if (!invitation_id || !guest_name) {
        return errorResponse("invitation_id dan guest_name wajib diisi", 400);
      }

      // Verify ownership
      const { data: inv } = await supabase
        .from("invitations")
        .select("id")
        .eq("id", invitation_id)
        .eq("user_id", user.id)
        .single();

      if (!inv) return errorResponse("Invitation not found or not authorized", 404);

      const finalSlug =
        customSlug ||
        String(guest_name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") +
          "-" + Date.now();

      const { data, error } = await supabase.from("guests").insert({
        invitation_id,
        guest_name: String(guest_name).trim().substring(0, 200),
        slug: finalSlug,
      }).select().single();

      if (error) {
        if (error.code === "23505") return errorResponse("Slug tamu sudah dipakai", 400);
        throw error;
      }

      return jsonResponse({ id: data.id, slug: finalSlug }, 201);
    }

    // -------------------------------------------------------
    // GET /guests/:invitation_id
    // -------------------------------------------------------
    if (req.method === "GET" && parts.length === 1) {
      const invitation_id = parts[0];

      const { data: inv } = await supabase
        .from("invitations")
        .select("id, slug")
        .eq("id", invitation_id)
        .eq("user_id", user.id)
        .single();

      if (!inv) return errorResponse("Invitation not found or not authorized", 404);

      const { data: guests, error } = await supabase
        .from("guests")
        .select("id, guest_name, slug, created_at")
        .eq("invitation_id", invitation_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return jsonResponse({ invitation_slug: inv.slug, guests: guests || [] });
    }

    // -------------------------------------------------------
    // DELETE /guests/:id
    // -------------------------------------------------------
    if (req.method === "DELETE" && parts.length === 1) {
      const id = parts[0];

      // RLS policy verifies ownership via invitations join
      const { data: guest } = await supabase
        .from("guests")
        .select("id, invitation_id")
        .eq("id", id)
        .single();

      if (!guest) return errorResponse("Tamu tidak ditemukan", 404);

      // Verify invitation belongs to user
      const { data: inv } = await supabase
        .from("invitations")
        .select("id")
        .eq("id", guest.invitation_id)
        .eq("user_id", user.id)
        .single();

      if (!inv) return errorResponse("Tidak berhak", 403);

      const { error } = await supabase.from("guests").delete().eq("id", id);
      if (error) throw error;

      return jsonResponse({ message: "Tamu dihapus" });
    }

    return errorResponse("Not Found", 404);
  } catch (err) {
    console.error(err);
    return errorResponse("Server error", 500);
  }
});
