// ============================================================
// Single Edge Function: api
// Handles all routes:
//   /api/invitations/*
//   /api/rsvp/*
//   /api/gallery/*
//   /api/guests/*
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- CORS ----
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Supabase clients ----
function getClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  // SUPABASE_SERVICE_ROLE_KEY is reserved by Supabase, so we use SERVICE_ROLE_KEY
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

// ---- Main handler ----
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // pathname example: /api/invitations/my  or  /api/rsvp
  const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const resource = segments[0]; // invitations | rsvp | gallery | guests
  const { supabase, admin } = getClients(req);

  try {
    // ===========================================================
    // INVITATIONS
    // ===========================================================
    if (resource === "invitations") {
      const sub = segments[1]; // 'my' | slug/id | undefined
      const action = segments[2]; // 'couple-photo' | 'music' | undefined

      // POST /api/invitations
      if (req.method === "POST" && !sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);

        const body = await req.json();
        const { groom_name, bride_name, wedding_date, akad_time, resepsi_time,
          venue_name, venue_address, primary_color, slug } = body;

        if (!groom_name || !bride_name || !wedding_date)
          return err("groom_name, bride_name, wedding_date wajib diisi", 400);

        const finalSlug = slug
          ? slug.toLowerCase().replace(/\s+/g, "-")
          : `${groom_name}-${bride_name}-${Date.now()}`
              .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");

        const { data, error } = await supabase.from("invitations").insert({
          user_id: user.id, slug: finalSlug, groom_name, bride_name, wedding_date,
          akad_time: akad_time || "08:00 WIB",
          resepsi_time: resepsi_time || "11:00 - 13:00 WIB",
          venue_name: venue_name || "Venue",
          venue_address: venue_address || "Alamat menyusul",
          primary_color: primary_color || "#4A6FA5",
        }).select().single();

        if (error) {
          if (error.code === "23505") return err("Slug sudah digunakan", 400);
          throw error;
        }
        return json({ message: "Invitation created successfully", invitationId: data.id, slug: finalSlug }, 201);
      }

      // GET /api/invitations/my
      if (req.method === "GET" && sub === "my") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data, error } = await supabase.from("invitations")
          .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }

      // GET /api/invitations/:slug — public
      if (req.method === "GET" && sub && !action) {
        const { data: invitation, error } = await admin
          .from("invitations").select("*").eq("slug", sub).single();
        if (error || !invitation) return err("Invitation not found", 404);

        const { data: gallery } = await admin.from("gallery")
          .select("*").eq("invitation_id", invitation.id)
          .order("created_at", { ascending: true });

        return json({ ...invitation, gallery: gallery || [] });
      }

      // PUT /api/invitations/:id
      if (req.method === "PUT" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const body = await req.json();
        const ALLOWED = ["groom_name","bride_name","wedding_date","akad_time","resepsi_time",
          "venue_name","venue_address","primary_color","gift_bank","gift_account_name",
          "gift_account_number","groom_parents_text","bride_parents_text","maps_url"];
        const updates: Record<string, string> = {};
        for (const k of ALLOWED) if (body[k] !== undefined) updates[k] = body[k];
        if (!Object.keys(updates).length) return err("No valid fields to update", 400);
        const { error } = await supabase.from("invitations")
          .update(updates).eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Invitation updated successfully" });
      }

      // DELETE /api/invitations/:id
      if (req.method === "DELETE" && sub && !action) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: inv } = await supabase.from("invitations")
          .select("groom_image,bride_image,music_url")
          .eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);

        const { data: galleryItems } = await supabase.from("gallery")
          .select("image_path").eq("invitation_id", sub);

        const paths: string[] = [];
        const ep = (u: string | null) => {
          if (!u) return;
          const m = u.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
          if (m) paths.push(m[1]);
        };
        ep(inv.groom_image); ep(inv.bride_image); ep(inv.music_url);
        for (const g of galleryItems || []) ep(g.image_path);
        if (paths.length) await admin.storage.from("uploads").remove(paths);

        const { error } = await supabase.from("invitations")
          .delete().eq("id", sub).eq("user_id", user.id);
        if (error) throw error;
        return json({ message: "Invitation deleted successfully" });
      }

      // POST /api/invitations/:id/couple-photo
      if (req.method === "POST" && action === "couple-photo") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("photo") as File | null;
        const role = formData.get("role") as string | null;
        if (!file || (role !== "groom" && role !== "bride"))
          return err("File dan role (groom/bride) wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${sub}/${role}-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads")
          .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        const col = role === "groom" ? "groom_image" : "bride_image";
        await supabase.from("invitations").update({ [col]: pu.publicUrl }).eq("id", sub);
        return json({ message: "Foto berhasil diupload", path: pu.publicUrl });
      }

      // POST /api/invitations/:id/music
      if (req.method === "POST" && action === "music") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("music") as File | null;
        if (!file) return err("File musik wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
        const path = `${user.id}/${sub}/music-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads")
          .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        await supabase.from("invitations").update({ music_url: pu.publicUrl }).eq("id", sub);
        return json({ message: "Musik berhasil diupload", path: pu.publicUrl });
      }
    }

    // ===========================================================
    // RSVP
    // ===========================================================
    if (resource === "rsvp") {
      const sub = segments[1];

      // POST /api/rsvp — public
      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { invitation_id, guest_name, attendance, total_guest, message } = body;
        if (!invitation_id || !guest_name || !attendance)
          return err("invitation_id, guest_name, attendance wajib diisi", 400);
        if (!["hadir","tidak","ragu"].includes(attendance))
          return err("attendance harus: hadir, tidak, atau ragu", 400);
        const { data: inv } = await admin.from("invitations").select("id").eq("id", invitation_id).single();
        if (!inv) return err("Invitation not found", 404);
        const { data, error } = await admin.from("rsvps").insert({
          invitation_id,
          guest_name: String(guest_name).trim().substring(0, 200),
          attendance,
          total_guest: Math.min(Math.max(parseInt(total_guest) || 1, 1), 20),
          message: message ? String(message).trim().substring(0, 1000) : "",
        }).select().single();
        if (error) throw error;
        return json({ message: "RSVP sent successfully", id: data.id }, 201);
      }

      // GET /api/rsvp/:invitation_id — protected
      if (req.method === "GET" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const { data, error } = await supabase.from("rsvps")
          .select("*").eq("invitation_id", sub).order("created_at", { ascending: false });
        if (error) throw error;
        return json(data);
      }
    }

    // ===========================================================
    // GALLERY
    // ===========================================================
    if (resource === "gallery") {
      const sub = segments[1]; // 'upload' | invitation_id | gallery_id

      // POST /api/gallery/upload — protected
      if (req.method === "POST" && sub === "upload") {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const formData = await req.formData();
        const file = formData.get("image") as File | null;
        const invitation_id = formData.get("invitation_id") as string | null;
        if (!file || !invitation_id) return err("File dan invitation_id wajib diisi", 400);
        if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type))
          return err("Hanya JPEG, PNG, WebP yang diizinkan", 400);
        if (file.size > 5 * 1024 * 1024) return err("Ukuran file maksimal 5MB", 400);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${invitation_id}/gallery-${Date.now()}.${ext}`;
        const { error: ue } = await admin.storage.from("uploads")
          .upload(path, await file.arrayBuffer(), { contentType: file.type });
        if (ue) throw ue;
        const { data: pu } = admin.storage.from("uploads").getPublicUrl(path);
        const { data, error } = await supabase.from("gallery")
          .insert({ invitation_id, image_path: pu.publicUrl }).select().single();
        if (error) throw error;
        return json({ message: "Image uploaded successfully", id: data.id, image_path: pu.publicUrl }, 201);
      }

      // GET /api/gallery/:invitation_id — public
      if (req.method === "GET" && sub) {
        const { data, error } = await admin.from("gallery")
          .select("*").eq("invitation_id", sub).order("created_at", { ascending: true });
        if (error) throw error;
        return json(data || []);
      }

      // DELETE /api/gallery/:id — protected
      if (req.method === "DELETE" && sub) {
        const user = await getUser(supabase);
        if (!user) return err("Unauthorized", 401);
        const { data: image } = await admin.from("gallery")
          .select("*, invitations!inner(user_id)").eq("id", sub).single();
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
    // GUESTS
    // ===========================================================
    if (resource === "guests") {
      const sub = segments[1]; // 'bulk' | invitation_id | guest_id
      const user = await getUser(supabase);
      if (!user) return err("Unauthorized", 401);

      // POST /api/guests/bulk
      if (req.method === "POST" && sub === "bulk") {
        const formData = await req.formData();
        const invitation_id = formData.get("invitation_id") as string | null;
        const file = formData.get("file") as File | null;
        if (!invitation_id || !file) return err("invitation_id dan file wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        let addedCount = 0;
        for (const line of lines) {
          const name = line.split(",")[0].replace(/^["']|["']$/g, "").trim();
          if (!name) continue;
          const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "")
            + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
          const { error } = await supabase.from("guests").insert({ invitation_id, guest_name: name, slug });
          if (!error) addedCount++;
        }
        return json({ message: `Berhasil menambahkan ${addedCount} tamu` }, 201);
      }

      // POST /api/guests
      if (req.method === "POST" && !sub) {
        const body = await req.json();
        const { invitation_id, guest_name, slug: cs } = body;
        if (!invitation_id || !guest_name) return err("invitation_id dan guest_name wajib diisi", 400);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const finalSlug = cs || String(guest_name).toLowerCase()
          .replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "") + "-" + Date.now();
        const { data, error } = await supabase.from("guests").insert({
          invitation_id,
          guest_name: String(guest_name).trim().substring(0, 200),
          slug: finalSlug,
        }).select().single();
        if (error) {
          if (error.code === "23505") return err("Slug tamu sudah dipakai", 400);
          throw error;
        }
        return json({ id: data.id, slug: finalSlug }, 201);
      }

      // GET /api/guests/:invitation_id
      if (req.method === "GET" && sub) {
        const { data: inv } = await supabase.from("invitations")
          .select("id,slug").eq("id", sub).eq("user_id", user.id).single();
        if (!inv) return err("Not found or not authorized", 404);
        const { data: guests, error } = await supabase.from("guests")
          .select("id,guest_name,slug,created_at").eq("invitation_id", sub)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ invitation_slug: inv.slug, guests: guests || [] });
      }

      // DELETE /api/guests/:id
      if (req.method === "DELETE" && sub) {
        const { data: guest } = await supabase.from("guests")
          .select("id,invitation_id").eq("id", sub).single();
        if (!guest) return err("Tamu tidak ditemukan", 404);
        const { data: inv } = await supabase.from("invitations")
          .select("id").eq("id", guest.invitation_id).eq("user_id", user.id).single();
        if (!inv) return err("Tidak berhak", 403);
        const { error } = await supabase.from("guests").delete().eq("id", sub);
        if (error) throw error;
        return json({ message: "Tamu dihapus" });
      }
    }

    return err("Not Found", 404);
  } catch (e) {
    console.error(e);
    return err("Server error", 500);
  }
});
