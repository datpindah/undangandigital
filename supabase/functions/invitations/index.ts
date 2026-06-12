// ============================================================
// Edge Function: invitations
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
  const parts = url.pathname.replace(/^\/invitations\/?/, "").split("/").filter(Boolean);

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
    // POST /invitations — create
    if (req.method === "POST" && parts.length === 0) {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const body = await req.json();
      const { groom_name, bride_name, wedding_date, akad_time, resepsi_time, venue_name, venue_address, primary_color, slug } = body;

      if (!groom_name || !bride_name || !wedding_date) {
        return errorResponse("groom_name, bride_name, wedding_date wajib diisi", 400);
      }

      const finalSlug = slug
        ? slug.toLowerCase().replace(/\s+/g, "-")
        : `${groom_name}-${bride_name}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

      const { data, error } = await supabase.from("invitations").insert({
        user_id: user.id,
        slug: finalSlug,
        groom_name,
        bride_name,
        wedding_date,
        akad_time: akad_time || "08:00 WIB",
        resepsi_time: resepsi_time || "11:00 - 13:00 WIB",
        venue_name: venue_name || "Venue",
        venue_address: venue_address || "Alamat menyusul",
        primary_color: primary_color || "#4A6FA5",
      }).select().single();

      if (error) {
        if (error.code === "23505") return errorResponse("Slug sudah digunakan", 400);
        throw error;
      }

      return jsonResponse({ message: "Invitation created successfully", invitationId: data.id, slug: finalSlug }, 201);
    }

    // GET /invitations/my
    if (req.method === "GET" && parts[0] === "my") {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const { data, error } = await supabase
        .from("invitations").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return jsonResponse(data);
    }

    // GET /invitations/:slug — public
    if (req.method === "GET" && parts.length === 1) {
      const { data: invitation, error } = await supabaseAdmin
        .from("invitations").select("*").eq("slug", parts[0]).single();

      if (error || !invitation) return errorResponse("Invitation not found", 404);

      const { data: gallery } = await supabaseAdmin
        .from("gallery").select("*").eq("invitation_id", invitation.id)
        .order("created_at", { ascending: true });

      return jsonResponse({ ...invitation, gallery: gallery || [] });
    }

    // PUT /invitations/:id
    if (req.method === "PUT" && parts.length === 1) {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const body = await req.json();
      const ALLOWED_FIELDS = [
        "groom_name", "bride_name", "wedding_date", "akad_time", "resepsi_time",
        "venue_name", "venue_address", "primary_color", "gift_bank",
        "gift_account_name", "gift_account_number", "groom_parents_text",
        "bride_parents_text", "maps_url",
      ];

      const updates: Record<string, string> = {};
      for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined) updates[key] = body[key];
      }

      if (Object.keys(updates).length === 0) return errorResponse("No valid fields to update", 400);

      const { error } = await supabase.from("invitations")
        .update(updates).eq("id", parts[0]).eq("user_id", user.id);

      if (error) throw error;
      return jsonResponse({ message: "Invitation updated successfully" });
    }

    // DELETE /invitations/:id
    if (req.method === "DELETE" && parts.length === 1) {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const { data: inv } = await supabase.from("invitations")
        .select("groom_image, bride_image, music_url")
        .eq("id", parts[0]).eq("user_id", user.id).single();

      if (!inv) return errorResponse("Invitation not found or not authorized", 404);

      const { data: galleryItems } = await supabase.from("gallery")
        .select("image_path").eq("invitation_id", parts[0]);

      const storagePaths: string[] = [];
      const extractPath = (url: string | null) => {
        if (!url) return;
        const match = url.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
        if (match) storagePaths.push(match[1]);
      };
      extractPath(inv.groom_image);
      extractPath(inv.bride_image);
      extractPath(inv.music_url);
      for (const g of galleryItems || []) extractPath(g.image_path);
      if (storagePaths.length > 0) await supabaseAdmin.storage.from("uploads").remove(storagePaths);

      const { error } = await supabase.from("invitations")
        .delete().eq("id", parts[0]).eq("user_id", user.id);

      if (error) throw error;
      return jsonResponse({ message: "Invitation deleted successfully" });
    }

    // POST /invitations/:id/couple-photo
    if (req.method === "POST" && parts[1] === "couple-photo") {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const formData = await req.formData();
      const file = formData.get("photo") as File | null;
      const role = formData.get("role") as string | null;

      if (!file || (role !== "groom" && role !== "bride")) {
        return errorResponse("File dan role (groom/bride) wajib diisi", 400);
      }

      const { data: inv } = await supabase.from("invitations")
        .select("id").eq("id", parts[0]).eq("user_id", user.id).single();
      if (!inv) return errorResponse("Not found or not authorized", 404);

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/${parts[0]}/${role}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("uploads").upload(filePath, await file.arrayBuffer(), { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabaseAdmin.storage.from("uploads").getPublicUrl(filePath);
      const column = role === "groom" ? "groom_image" : "bride_image";
      await supabase.from("invitations").update({ [column]: publicUrl.publicUrl }).eq("id", parts[0]);

      return jsonResponse({ message: "Foto berhasil diupload", path: publicUrl.publicUrl });
    }

    // POST /invitations/:id/music
    if (req.method === "POST" && parts[1] === "music") {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const formData = await req.formData();
      const file = formData.get("music") as File | null;
      if (!file) return errorResponse("File musik wajib diisi", 400);

      const { data: inv } = await supabase.from("invitations")
        .select("id").eq("id", parts[0]).eq("user_id", user.id).single();
      if (!inv) return errorResponse("Not found or not authorized", 404);

      const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
      const filePath = `${user.id}/${parts[0]}/music-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("uploads").upload(filePath, await file.arrayBuffer(), { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabaseAdmin.storage.from("uploads").getPublicUrl(filePath);
      await supabase.from("invitations").update({ music_url: publicUrl.publicUrl }).eq("id", parts[0]);

      return jsonResponse({ message: "Musik berhasil diupload", path: publicUrl.publicUrl });
    }

    return errorResponse("Not Found", 404);
  } catch (err) {
    console.error(err);
    return errorResponse("Server error", 500);
  }
});
