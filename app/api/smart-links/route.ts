import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

const smartLinkSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  title: z.string().min(1).max(200),
  artist: z.string().optional(),
  artwork_url: z.string().url().optional().or(z.literal("")),
  platforms: z.array(z.object({
    platform: z.string(),
    url: z.string().url(), // Strictly validate URLs
  })),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate request body, useful against malicious JSON
    const result = smartLinkSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json({ error: result.error.format() }, { status: 400 })
    }

    const { slug, title, artist, artwork_url, platforms, tracks } = body

    const supabase = await createClient()

    // Server-side validation helpers
    const isValidUrl = (string: string) => {
      try {
        const url = new URL(string)
        return url.protocol === "http:" || url.protocol === "https:"
      } catch (_) {
        return false
      }
    }

    // Validate inputs
    if (artwork_url && !isValidUrl(artwork_url)) {
      return NextResponse.json({ error: "Invalid artwork URL provided" }, { status: 400 })
    }

    if (platforms && Array.isArray(platforms)) {
      for (const p of platforms) {
        // --- THIS IS THE FIX ---
        // Skip URL validation for our special internal platform types.
        if (p.platform === 'meta_type' || p.platform === 'preview') {
            continue;
        }

        if (!p.url || !isValidUrl(p.url)) {
          // Provide a more descriptive error for easier debugging
          return NextResponse.json({ error: `Invalid URL provided for platform: ${p.platform}` }, { status: 400 })
        }
      }
    }

    // Check if link already exists
    const { data: existingLink } = await supabase
      .from("smart_links")
      .select("slug")
      .match({ title, artist: artist || null })
      .maybeSingle()

    if (existingLink) {
      return NextResponse.json({ slug: existingLink.slug })
    }

    // Create the smart link
    const { data: smartLink, error: linkError } = await supabase
      .from("smart_links")
      .insert({
        slug,
        title,
        artist: artist || null,
        artwork_url: artwork_url || null,
      })
      .select()
      .single()

    if (linkError) {
      console.error("[API] Error creating smart link:", linkError)
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    // Create platform links
    if (platforms && platforms.length > 0) {
      const platformData = platforms.map((p: { platform: string; url: string }) => ({
        smart_link_id: smartLink.id,
        platform: p.platform,
        url: p.url,
      }))

      const { error: platformError } = await supabase.from("platform_links").insert(platformData)

      if (platformError) {
        console.error("[API] Error creating platform links:", platformError)
        await supabase.from("smart_links").delete().eq("id", smartLink.id)
        return NextResponse.json({ error: platformError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ slug: smartLink.slug })
  } catch (error) {
    console.error("[API] Error in POST /api/smart-links:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}