import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { queryNeon, checkNeonConnection } from "./neon"

export interface SmartLink {
  id: string
  slug: string
  title: string
  artist: string | null
  artwork_url: string | null
  created_at: string
}

export interface PlatformLink {
  id: string
  smart_link_id: string
  platform: string
  url: string
  created_at: string
}

let supabaseHealthy = true
let lastHealthCheck = 0
const HEALTH_CHECK_INTERVAL = 60000 // 1 minute

async function checkSupabaseHealth(): Promise<boolean> {
  const now = Date.now()
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return supabaseHealthy
  }
  
  lastHealthCheck = now
  
  try {
    const cookieStore = await cookies()
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    
    const { error } = await client.from("smart_links").select("id").limit(1)
    supabaseHealthy = !error
    return supabaseHealthy
  } catch {
    supabaseHealthy = false
    return false
  }
}

async function createSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context - ignore
          }
        },
      },
    }
  )
}

// Database client with automatic fallback
export async function createDbClient() {
  const useSupabase = await checkSupabaseHealth()
  
  if (useSupabase) {
    const supabase = await createSupabaseClient()
    return { type: "supabase" as const, client: supabase }
  }
  
  // Verify Neon is available
  const neonHealthy = await checkNeonConnection()
  if (!neonHealthy) {
    // Try Supabase anyway as last resort
    const supabase = await createSupabaseClient()
    return { type: "supabase" as const, client: supabase }
  }
  
  return { type: "neon" as const }
}

// Query helpers with fallback logic
export async function getSmartLinkBySlug(slug: string): Promise<SmartLink | null> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const { data, error } = await db.client
      .from("smart_links")
      .select("*")
      .eq("slug", slug)
      .single()
    
    if (error) {
      // Fallback to Neon on error
      console.log("[DB] Supabase error, falling back to Neon:", error.message)
      return getSmartLinkBySlugNeon(slug)
    }
    return data
  }
  
  return getSmartLinkBySlugNeon(slug)
}

async function getSmartLinkBySlugNeon(slug: string): Promise<SmartLink | null> {
  const rows = await queryNeon<SmartLink>(
    "SELECT * FROM smart_links WHERE slug = $1 LIMIT 1",
    [slug]
  )
  return rows[0] || null
}

export async function getSmartLinkByTitleArtist(title: string, artist: string | null): Promise<{ slug: string } | null> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const { data } = await db.client
      .from("smart_links")
      .select("slug")
      .eq("title", title)
      .eq("artist", artist || null)
      .maybeSingle()
    
    return data
  }
  
  const rows = await queryNeon<{ slug: string }>(
    "SELECT slug FROM smart_links WHERE title = $1 AND (artist = $2 OR (artist IS NULL AND $2 IS NULL)) LIMIT 1",
    [title, artist]
  )
  return rows[0] || null
}

export async function getPlatformLinks(smartLinkId: string): Promise<PlatformLink[]> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const { data, error } = await db.client
      .from("platform_links")
      .select("*")
      .eq("smart_link_id", smartLinkId)
    
    if (error) {
      console.log("[DB] Supabase error fetching platforms, falling back to Neon:", error.message)
      return getPlatformLinksNeon(smartLinkId)
    }
    return data || []
  }
  
  return getPlatformLinksNeon(smartLinkId)
}

async function getPlatformLinksNeon(smartLinkId: string): Promise<PlatformLink[]> {
  return queryNeon<PlatformLink>(
    "SELECT * FROM platform_links WHERE smart_link_id = $1",
    [smartLinkId]
  )
}

export async function insertSmartLink(
  slug: string,
  title: string,
  artist: string | null,
  artworkUrl: string | null
): Promise<SmartLink | null> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const { data, error } = await db.client
      .from("smart_links")
      .insert({
        slug,
        title,
        artist: artist || null,
        artwork_url: artworkUrl || null,
      })
      .select()
      .single()
    
    if (error) {
      console.log("[DB] Supabase insert error, falling back to Neon:", error.message)
      return insertSmartLinkNeon(slug, title, artist, artworkUrl)
    }
    return data
  }
  
  return insertSmartLinkNeon(slug, title, artist, artworkUrl)
}

async function insertSmartLinkNeon(
  slug: string,
  title: string,
  artist: string | null,
  artworkUrl: string | null
): Promise<SmartLink | null> {
  const rows = await queryNeon<SmartLink>(
    `INSERT INTO smart_links (slug, title, artist, artwork_url) 
     VALUES ($1, $2, $3, $4) 
     RETURNING *`,
    [slug, title, artist, artworkUrl]
  )
  return rows[0] || null
}

export async function insertPlatformLinks(
  smartLinkId: string,
  platforms: Array<{ platform: string; url: string }>
): Promise<boolean> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const platformData = platforms.map(p => ({
      smart_link_id: smartLinkId,
      platform: p.platform,
      url: p.url,
    }))
    
    const { error } = await db.client
      .from("platform_links")
      .insert(platformData)
    
    if (error) {
      console.log("[DB] Supabase platform insert error, falling back to Neon:", error.message)
      return insertPlatformLinksNeon(smartLinkId, platforms)
    }
    return !error
  }
  
  return insertPlatformLinksNeon(smartLinkId, platforms)
}

async function insertPlatformLinksNeon(
  smartLinkId: string,
  platforms: Array<{ platform: string; url: string }>
): Promise<boolean> {
  try {
    for (const p of platforms) {
      await queryNeon(
        `INSERT INTO platform_links (smart_link_id, platform, url) VALUES ($1, $2, $3)`,
        [smartLinkId, p.platform, p.url]
      )
    }
    return true
  } catch {
    return false
  }
}

export async function deleteSmartLink(id: string): Promise<boolean> {
  const db = await createDbClient()
  
  if (db.type === "supabase") {
    const { error } = await db.client
      .from("smart_links")
      .delete()
      .eq("id", id)
    
    return !error
  }
  
  try {
    await queryNeon("DELETE FROM smart_links WHERE id = $1", [id])
    return true
  } catch {
    return false
  }
}

// Export original Supabase client for backward compatibility
export { createSupabaseClient as createClient }
