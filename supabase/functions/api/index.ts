// ============================================================
// Single Edge Function: api
// Handles ALL routes for both Wedding and Haflah invitations
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function getClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const admin = createClient(url, service);
  return { supabase, admin };
}
async function getUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}
function ep(u: string | null, paths: string[]) {
  if (!u) return;
  const m = u.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
  if (m) paths.push(m[1]);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/+/, "");
  const pathWithoutFunction = rawPath.replace(/^api\/?/, "");
  const segments = pathWithoutFunction.split("/").filter(Boolean);
  const resource = segments[0];
  const { supabase, admin } = getClients(req);

  console.log(`[api] ${req.method} ${url.pathname} | resource=${resource}`);

  try {

    // ===========================================================
    // WEDDING INVITATIONS
    // ===========================================================
    if (resource === "invitations") {
      const sub = segments[1];
      const action = segments[2];

      if (req.method === "POST" && !sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const body = await req.json();
        const { groom_name, bride_name, wedding_date, akad_time, resepsi_time, venue_name, venue_address, primary_color, slug } = body;
        if (!groom_name || !bride_name || !wedding_date) return err("groom_name, bride_name, wedding_date wajib diisi", 400);
        const finalSlug = slug ? slug.toLowerCase().replace(/\s+/g, "-") : `${groom_name}-${bride_name}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
        const { data, error } = await supabase.from("invitations").insert({
          user_id: user.id, slug: finalSlug, groom_name, bride_name, wedding_date,
          akad_time: akad_time || "08:00 WIB", resepsi_time: resepsi_time || "11:00 - 13:00 WIB",
          venue_name: venue_name || "Venue", venue_address: venue_address || "Alamat menyusul",
          primary_color: primary_color || "#4A6FA5",
        }).select().single();
        if (error) { if (error.code === "23505") return err("Slug sudah digunakan", 400); throw error; }
        return json({ message: "Invitation created successfully", invitationId: data.id, slug: finalSlug }, 201);
      }

      if (req.method === "GET" && sub === "my") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data, error } = await supabase.from("invitations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      if (req.method === "GET" && sub && !action) {
        const { data: invitation, error } = await admin.from("invitations").select("*").eq("slug", sub).single();
        if (error || !invitation) return err("Invitation not found", 404);
        const { data: gallery } = await admin.from("gallery").select("*").eq("invitation_id", invitation.id).order("created_at", { ascending: true });
        return json({ ...invitation, gallery: gallery || [] });
      }

      if (req.method === "PUT" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const body = await req.json();
        const ALLOWED = ["groom_name","bride_name","wedding_date","akad_time","resepsi_time","venue_name","venue_address","primary_color","gift_bank","gift_account_name","gift_account_number","groom_parents_text","bride_parents_text","maps_url"];
        const updates: Record<string, string> = {};
        for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
        if (!Object.keys(updates).length) return err("No valid fields to update", 400);
        const { error } = await supabase.from("invitations").update(updates).eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Invitation updated successfully" });
      }

      if (req.method === "DELETE" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: inv } = await supabase.from("invitations").select("groom_image,bride_image,music_url").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const { data: galleryItems } = await supabase.from("gallery").select("image_path").eq("invitation_id", sub);
        const paths: string[] = [];
        ep(inv.groom_image, paths); ep(inv.bride_image, paths); ep(inv.music_url, paths);
        for (const g of galleryItems || []) ep(g.image_path, paths);
        if (paths.length) await admin.storage.from("uploads").remove(paths);
        const { error } = await supabase.from("invitations").delete().eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Invitation deleted successfully" });
      }

      if (req.method === "POST" && action === "couple-photo") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("photo") as File | null;
        const role = formData.get("role") as string | null;
        if (!file || (role !== "groom" && role !== "bride")) return err("File dan role wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${sub}/${role}-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        const col = role === "groom" ? "groom_image" : "bride_image";
        await supabase.from("invitations").update({ [col]: pu.publicUrl }).eq("id", sub);
        return json({ message: "Foto berhasil diupload", path: pu.publicUrl });
      }

      if (req.method === "POST" && action === "music") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("music") as File | null;
        if (!file) return err("File musik wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const path = `${user.id}/${sub}/music-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        await supabase.from("invitations").update({ music_url: pu.publicUrl }).eq("id", sub);
        return json({ message: "Musik berhasil diupload", path: pu.publicUrl });
      }
    }

    // ===========================================================
    // HAFLAH INVITATIONS
    // ===========================================================
    if (resource === "haflah") {
      const sub = segments[1];
      const action = segments[2];

      // POST /haflah — buat haflah baru
      if (req.method === "POST" && !sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const body = await req.json();
        const { event_name, institution_name, event_subtitle, event_date, event_description, venue_name, venue_address, maps_url, primary_color, secondary_color, organizer_name, organizer_phone, slug } = body;
        if (!event_name || !event_date) return err("event_name dan event_date wajib diisi", 400);
        const finalSlug = slug ? slug.toLowerCase().replace(/\s+/g, "-") : `${event_name}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
        const { data, error } = await supabase.from("haflah_invitations").insert({
          user_id: user.id, slug: finalSlug, event_name,
          institution_name: institution_name || "",
          event_subtitle: event_subtitle || "",
          event_date,
          event_description: event_description || "",
          venue_name: venue_name || "Venue",
          venue_address: venue_address || "Alamat menyusul",
          maps_url: maps_url || null,
          primary_color: primary_color || "#1E40AF",
          secondary_color: secondary_color || "#F59E0B",
          organizer_name: organizer_name || "",
          organizer_phone: organizer_phone || "",
          schedule: [],
        }).select().single();
        if (error) { if (error.code === "23505") return err("Slug sudah digunakan", 400); throw error; }
        return json({ message: "Haflah created successfully", haflahId: data.id, slug: finalSlug }, 201);
      }

      // GET /haflah/my
      if (req.method === "GET" && sub === "my") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data, error } = await supabase.from("haflah_invitations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      // GET /haflah/:slug — public
      if (req.method === "GET" && sub && !action) {
        const { data: haflah, error } = await admin.from("haflah_invitations").select("*").eq("slug", sub).single();
        if (error || !haflah) return err("Haflah not found", 404);
        const { data: gallery } = await admin.from("haflah_gallery").select("*").eq("haflah_id", haflah.id).order("created_at", { ascending: true });
        return json({ ...haflah, gallery: gallery || [] });
      }

      // PUT /haflah/:id
      if (req.method === "PUT" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const body = await req.json();
        const ALLOWED = ["event_name","institution_name","event_subtitle","event_date","event_description","venue_name","venue_address","maps_url","primary_color","secondary_color","organizer_name","organizer_phone","schedule"];
        const updates: Record<string, any> = {};
        for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
        if (!Object.keys(updates).length) return err("No valid fields to update", 400);
        const { error } = await supabase.from("haflah_invitations").update(updates).eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Haflah updated successfully" });
      }

      // DELETE /haflah/:id
      if (req.method === "DELETE" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: haf } = await supabase.from("haflah_invitations").select("banner_image,music_url").eq("id", sub).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const { data: galleryItems } = await supabase.from("haflah_gallery").select("image_path").eq("haflah_id", sub);
        const paths: string[] = [];
        ep(haf.banner_image, paths); ep(haf.music_url, paths);
        for (const g of galleryItems || []) ep(g.image_path, paths);
        if (paths.length) await admin.storage.from("uploads").remove(paths);
        const { error } = await supabase.from("haflah_invitations").delete().eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Haflah deleted successfully" });
      }

      // POST /haflah/:id/banner
      if (req.method === "POST" && action === "banner") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("banner") as File | null;
        if (!file) return err("File banner wajib diisi", 400);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${sub}/banner-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        await supabase.from("haflah_invitations").update({ banner_image: pu.publicUrl }).eq("id", sub);
        return json({ message: "Banner berhasil diupload", path: pu.publicUrl });
      }

      // POST /haflah/:id/music
      if (req.method === "POST" && action === "music") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("music") as File | null;
        if (!file) return err("File musik wajib diisi", 400);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const path = `${user.id}/${sub}/haflah-music-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        await supabase.from("haflah_invitations").update({ music_url: pu.publicUrl }).eq("id", sub);
        return json({ message: "Musik berhasil diupload", path: pu.publicUrl });
      }
    }

    // ===========================================================
    // HAFLAH RSVP
    // ===========================================================
    if (resource === "haflah-rsvp") {
      const sub = segments[1];

      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { haflah_id, guest_name, attendance, total_guest, message } = body;
        if (!haflah_id || !guest_name || !attendance) return err("haflah_id, guest_name, attendance wajib diisi", 400);
        if (!["hadir","tidak","ragu"].includes(attendance)) return err("attendance harus: hadir, tidak, atau ragu", 400);
        const { data: haf } = await admin.from("haflah_invitations").select("id").eq("id", haflah_id).single();
        if (!haf) return err("Haflah not found", 404);
        const { data, error } = await admin.from("haflah_rsvps").insert({
          haflah_id, guest_name: String(guest_name).trim().substring(0, 200), attendance,
          total_guest: Math.min(Math.max(parseInt(total_guest) || 1, 1), 20),
          message: message ? String(message).trim().substring(0, 1000) : "",
        }).select().single();
        if (error) throw error;
        return json({ message: "RSVP sent successfully", id: data.id }, 201);
      }

      if (req.method === "GET" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const { data, error } = await supabase.from("haflah_rsvps").select("*").eq("haflah_id", sub).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }
    }

    // ===========================================================
    // HAFLAH GALLERY
    // ===========================================================
    if (resource === "haflah-gallery") {
      const sub = segments[1];

      if (req.method === "POST" && sub === "upload") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        const haflah_id = formData.get("haflah_id") as string | null;
        if (!file || !haflah_id) return err("File dan haflah_id wajib diisi", 400);
        if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)) return err("Hanya JPEG, PNG, WebP", 400);
        if (file.size > 5 * 1024 * 1024) return err("Maksimal 5MB", 400);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", haflah_id).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${haflah_id}/haflah-gallery-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        const { data, error } = await supabase.from("haflah_gallery").insert({ haflah_id, image_path: pu.publicUrl }).select().single();
        if (error) throw error;
        return json({ message: "Image uploaded", id: data.id, image_path: pu.publicUrl }, 201);
      }

      if (req.method === "GET" && sub) {
        const { data, error } = await admin.from("haflah_gallery").select("*").eq("haflah_id", sub).order("created_at", { ascending: true });
        if (error) throw error;
        return json(data || []);
      }

      if (req.method === "DELETE" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: image } = await admin.from("haflah_gallery").select("*, haflah_invitations!inner(user_id)").eq("id", sub).single();
        if (!image) return err("Image not found", 404);
        if ((image as any).haflah_invitations.user_id !== user.id) return err("Not authorized", 403);
        const m = (image.image_path as string).match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
        if (m) await admin.storage.from("uploads").remove([m[1]]);
        const { error } = await supabase.from("haflah_gallery").delete().eq("id", sub);
        if (error) throw error;
        return json({ message: "Image deleted" });
      }
    }

    // ===========================================================
    // HAFLAH GUESTS
    // ===========================================================
    if (resource === "haflah-guests") {
      const sub = segments[1];
      const user = await getUser(supabase);
      if (!user) return err("Unauthorized", 401);

      if (req.method === "POST" && sub === "bulk") {
        const formData = await req.formData();
        const haflah_id = formData.get("haflah_id") as string | null;
        const file = formData.get("file") as File | null;
        if (!haflah_id || !file) return err("haflah_id dan file wajib diisi", 400);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", haflah_id).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
        let addedCount = 0;
        for (const line of lines) {
          const name = line.split(",")[0].replace(/^["']|["']$/g, "").trim();
          if (!name) continue;
          const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
          const { error } = await supabase.from("haflah_guests").insert({ haflah_id, guest_name: name, slug });
          if (!error) addedCount++;
        }
        return json({ message: `Berhasil menambahkan ${addedCount} tamu` }, 201);
      }

      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { haflah_id, guest_name, slug: cs } = body;
        if (!haflah_id || !guest_name) return err("haflah_id dan guest_name wajib diisi", 400);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", haflah_id).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const finalSlug = cs || String(guest_name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + "-" + Date.now();
        const { data, error } = await supabase.from("haflah_guests").insert({ haflah_id, guest_name: String(guest_name).trim().substring(0, 200), slug: finalSlug }).select().single();
        if (error) { if (error.code === "23505") return err("Slug tamu sudah dipakai", 400); throw error; }
        return json({ id: data.id, slug: finalSlug }, 201);
      }

      if (req.method === "GET" && sub) {
        const { data: haf } = await supabase.from("haflah_invitations").select("id,slug").eq("id", sub).eq("user_id", user.id).single();
        if (!haf) return err("Not found or not authorized", 404);
        const { data: guests, error } = await supabase.from("haflah_guests").select("id,guest_name,slug,created_at").eq("haflah_id", sub).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ haflah_slug: haf.slug, guests: guests || [] });
      }

      if (req.method === "DELETE" && sub) {
        const { data: guest } = await supabase.from("haflah_guests").select("id,haflah_id").eq("id", sub).single();
        if (!guest) return err("Tamu tidak ditemukan", 404);
        const { data: haf } = await supabase.from("haflah_invitations").select("id").eq("id", guest.haflah_id).eq("user_id", user.id).single();
        if (!haf) return err("Tidak berhak", 403);
        const { error } = await supabase.from("haflah_guests").delete().eq("id", sub);
        if (error) throw error;
        return json({ message: "Tamu dihapus" });
      }
    }

    // ===========================================================
    // WEDDING RSVP
    // ===========================================================
    if (resource === "rsvp") {
      const sub = segments[1];
      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { invitation_id, guest_name, attendance, total_guest, message } = body;
        if (!invitation_id || !guest_name || !attendance) return err("invitation_id, guest_name, attendance wajib diisi", 400);
        if (!["hadir","tidak","ragu"].includes(attendance)) return err("attendance harus: hadir, tidak, atau ragu", 400);
        const { data: inv } = await admin.from("invitations").select("id").eq("id", invitation_id).single();
        if (!inv) return err("Invitation not found", 404);
        const { data, error } = await admin.from("rsvps").insert({
          invitation_id, guest_name: String(guest_name).trim().substring(0, 200), attendance,
          total_guest: Math.min(Math.max(parseInt(total_guest) || 1, 1), 20),
          message: message ? String(message).trim().substring(0, 1000) : "",
        }).select().single();
        if (error) throw error;
        return json({ message: "RSVP sent successfully", id: data.id }, 201);
      }
      if (req.method === "GET" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const { data, error } = await supabase.from("rsvps").select("*").eq("invitation_id", sub).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }
    }

    // ===========================================================
    // WEDDING GALLERY
    // ===========================================================
    if (resource === "gallery") {
      const sub = segments[1];
      if (req.method === "POST" && sub === "upload") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        const invitation_id = formData.get("invitation_id") as string | null;
        if (!file || !invitation_id) return err("File dan invitation_id wajib diisi", 400);
        if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)) return err("Hanya JPEG, PNG, WebP", 400);
        if (file.size > 5 * 1024 * 1024) return err("Maksimal 5MB", 400);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${invitation_id}/gallery-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads").upload(path, await file.arrayBuffer(), { contentType: file.type });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        const { data, error } = await supabase.from("gallery").insert({ invitation_id, image_path: pu.publicUrl }).select().single();
        if (error) throw error;
        return json({ message: "Image uploaded successfully", id: data.id, image_path: pu.publicUrl }, 201);
      }
      if (req.method === "GET" && sub) {
        const { data, error } = await admin.from("gallery").select("*").eq("invitation_id", sub).order("created_at", { ascending: true });
        if (error) throw error;
        return json(data || []);
      }
      if (req.method === "DELETE" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: image } = await admin.from("gallery").select("*, invitations!inner(user_id)").eq("id", sub).single();
        if (!image) return err("Image not found", 404);
        if ((image as any).invitations.user_id !== user.id) return err("Not authorized", 403);
        const m = (image.image_path as string).match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
        if (m) await admin.storage.from("uploads").remove([m[1]]);
        const { error } = await supabase.from("gallery").delete().eq("id", sub);
        if (error) throw error;
        return json({ message: "Image deleted successfully" });
      }
    }

    // ===========================================================
    // WEDDING GUESTS
    // ===========================================================
    if (resource === "guests") {
      const sub = segments[1];
      const user = await getUser(supabase);
      if (!user) return err("Unauthorized", 401);
      if (req.method === "POST" && sub === "bulk") {
        const formData = await req.formData();
        const invitation_id = formData.get("invitation_id") as string | null;
        const file = formData.get("file") as File | null;
        if (!invitation_id || !file) return err("invitation_id dan file wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l: string) => l.trim());
        let addedCount = 0;
        for (const line of lines) {
          const name = line.split(",")[0].replace(/^["']|["']$/g, "").trim();
          if (!name) continue;
          const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
          const { error } = await supabase.from("guests").insert({ invitation_id, guest_name: name, slug });
          if (!error) addedCount++;
        }
        return json({ message: `Berhasil menambahkan ${addedCount} tamu` }, 201);
      }
      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { invitation_id, guest_name, slug: cs } = body;
        if (!invitation_id || !guest_name) return err("invitation_id dan guest_name wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const finalSlug = cs || String(guest_name).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + "-" + Date.now();
        const { data, error } = await supabase.from("guests").insert({ invitation_id, guest_name: String(guest_name).trim().substring(0, 200), slug: finalSlug }).select().single();
        if (error) { if (error.code === "23505") return err("Slug tamu sudah dipakai", 400); throw error; }
        return json({ id: data.id, slug: finalSlug }, 201);
      }
      if (req.method === "GET" && sub) {
        const { data: inv } = await supabase.from("invitations").select("id,slug").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const { data: guests, error } = await supabase.from("guests").select("id,guest_name,slug,created_at").eq("invitation_id", sub).order("created_at", { ascending: false });
        if (error) throw error;
        return json({ invitation_slug: inv.slug, guests: guests || [] });
      }
      if (req.method === "DELETE" && sub) {
        const { data: guest } = await supabase.from("guests").select("id,invitation_id").eq("id", sub).single();
        if (!guest) return err("Tamu tidak ditemukan", 404);
        const { data: inv } = await supabase.from("invitations").select("id").eq("id", guest.invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Tidak berhak", 403);
        const { error } = await supabase.from("guests").delete().eq("id", sub);
        if (error) throw error;
        return json({ message: "Tamu dihapus" });
      }
    }

    return err(`Route tidak ditemukan: ${req.method} ${url.pathname}`, 404);

  } catch (e: any) {
    console.error("[api] error:", e?.message || e);
    return err(e?.message || "Server error", 500);
  }
});
