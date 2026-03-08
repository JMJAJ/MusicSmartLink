import { 
  getSmartLinkByTitleArtist, 
  insertSmartLink, 
  insertPlatformLinks,
  deleteSmartLink 
} from "@/lib/db"
import { NextResponse } from "next/server"
import { z } from "zod"

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

    // 2. Check for existing link by title + artist (prevent duplicates)
    const existingLink = await getSmartLinkByTitleArtist(title, artist || null)

    if (existingLink) {
       // Return existing link instead of creating duplicate
       return NextResponse.json({ slug: existingLink.slug })
    }

    // 3. Insert Smart Link
    const smartLink = await insertSmartLink(slug, title, artist || null, artwork_url || null)

    if (!smartLink) {
      console.error("[API] DB Error: Failed to insert smart link")
      return NextResponse.json({ error: "Failed to create smart link" }, { status: 400 })
    }

    // 4. Insert Platforms
    if (platforms && platforms.length > 0) {
      const success = await insertPlatformLinks(smartLink.id, platforms)

      if (!success) {
        console.error("[API] Platform DB Error")
        // Cleanup the smart link if platforms fail
        await deleteSmartLink(smartLink.id)
        return NextResponse.json({ error: "Failed to insert platform links" }, { status: 400 })
      }
    }

    return NextResponse.json({ slug: smartLink.slug })
  } catch (error) {
    console.error("[API] Server Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}