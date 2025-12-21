import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { z } from "zod"

// UPDATED SCHEMA
const smartLinkSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  title: z.string().min(1).max(200),
  artist: z.string().optional().nullable(), // Allow null coming from JSON
  artwork_url: z.string().url().optional().or(z.literal("")).nullable(),
  platforms: z.array(
    z.object({
      platform: z.string(),
      url: z.string(),
    }).refine((data) => {
      // If platform is 'meta_type', allow any string (like "album")
      if (data.platform === "meta_type") return true
      
      // For everything else, strictly require a valid URL
      return z.string().url().safeParse(data.url).success
    }, {
      message: "Invalid URL provided",
      path: ["url"]
    })
  ),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 1. Validate with Zod
    const result = smartLinkSchema.safeParse(body)
    
    if (!result.success) {
      console.error("Validation Error:", result.error.flatten())
      return NextResponse.json({ 
        error: "Validation failed", 
        details: result.error.flatten() 
      }, { status: 400 })
    }

    const { slug, title, artist, artwork_url, platforms } = result.data
    const supabase = await createClient()

    // 2. Check for existing link
    const { data: existingLink } = await supabase
      .from("smart_links")
      .select("slug")
      .eq("slug", slug) // Better to check exact slug match for uniqueness
      .maybeSingle()

    if (existingLink) {
       // If slug exists, maybe append a random string or return existing?
       // For now, let's assume if it exists we return it.
       return NextResponse.json({ slug: existingLink.slug })
    }

    // 3. Insert Smart Link
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
      console.error("[API] DB Error:", linkError)
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    // 4. Insert Platforms
    if (platforms && platforms.length > 0) {
      const platformData = platforms.map((p) => ({
        smart_link_id: smartLink.id,
        platform: p.platform,
        url: p.url,
      }))

      const { error: platformError } = await supabase
        .from("platform_links")
        .insert(platformData)

      if (platformError) {
        console.error("[API] Platform DB Error:", platformError)
        // Optional: Cleanup the smart link if platforms fail
        await supabase.from("smart_links").delete().eq("id", smartLink.id)
        return NextResponse.json({ error: platformError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ slug: smartLink.slug })
  } catch (error) {
    console.error("[API] Server Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}