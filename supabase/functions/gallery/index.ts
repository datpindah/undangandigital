import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse, getUser } from "../_shared/utils.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/gallery\/?/, "").split("/").filter(Boolean);
  // parts[0] = 'upload' | invitation_id | gallery_id

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
    // -------------------------------------------------------
    // POST /gallery/upload — protected
    // -------------------------------------------------------
    if (req.method === "POST" && parts[0] === "upload") {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const formData = await req.formData();
      const file = formData.get("image") as File | null;
      const invitation_id = formData.get("invitation_id") as string | null;

      if (!file || !invitation_id) {
        return errorResponse("File gambar dan invitation_id wajib diisi", 400);
      }

      // Verify ownership
      const { data: inv } = await supabase
        .from("invitations")
        .select("id")
        .eq("id", invitation_id)
        .eq("user_id", user.id)
        .single();

      if (!inv) return errorResponse("Invitation not found or not authorized", 404);

      // Validate image type
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        return errorResponse("Hanya file gambar yang diizinkan (JPEG, PNG, WebP)", 400);
      }

      if (file.size > 5 * 1024 * 1024) {
        return errorResponse("Ukuran file maksimal 5MB", 400);
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/${invitation_id}/gallery-${Date.now()}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabaseAdmin.storage
        .from("uploads")
        .upload(filePath, arrayBuffer, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabaseAdmin.storage.from("uploads").getPublicUrl(filePath);

      const { data, error } = await supabase.from("gallery").insert({
        invitation_id,
        image_path: publicUrl.publicUrl,
      }).select().single();

      if (error) throw error;

      return jsonResponse({
        message: "Image uploaded successfully",
        id: data.id,
        image_path: publicUrl.publicUrl,
      }, 201);
    }

    // -------------------------------------------------------
    // GET /gallery/:invitation_id — public
    // -------------------------------------------------------
    if (req.method === "GET" && parts.length === 1) {
      const invitation_id = parts[0];

      const { data, error } = await supabaseAdmin
        .from("gallery")
        .select("*")
        .eq("invitation_id", invitation_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return jsonResponse(data || []);
    }

    // -------------------------------------------------------
    // DELETE /gallery/:id — protected
    // -------------------------------------------------------
    if (req.method === "DELETE" && parts.length === 1) {
      const user = await getUser(supabase);
      if (!user) return errorResponse("Unauthorized", 401);

      const id = parts[0];

      const { data: image } = await supabase
        .from("gallery")
        .select("*, invitations!inner(user_id)")
        .eq("id", id)
        .single();

      if (!image) return errorResponse("Image not found", 404);
      if ((image as any).invitations.user_id !== user.id) return errorResponse("Not authorized", 403);

      // Extract storage path from URL
      const imageUrl = image.image_path as string;
      const storagePathMatch = imageUrl.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
      if (storagePathMatch) {
        await supabaseAdmin.storage.from("uploads").remove([storagePathMatch[1]]);
      }

      const { error } = await supabase.from("gallery").delete().eq("id", id);
      if (error) throw error;

      return jsonResponse({ message: "Image deleted successfully" });
    }

    return errorResponse("Not Found", 404);
  } catch (err) {
    console.error(err);
    return errorResponse("Server error", 500);
  }
});
