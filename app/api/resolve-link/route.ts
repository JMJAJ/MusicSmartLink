import { type NextRequest, NextResponse } from "next/server"
import { findCachedSongBySpotifyUrl } from "@/lib/db"

interface SongLinkResponse {
  entityUniqueId: string
  userCountry: string
  pageUrl: string
  entitiesByUniqueId: Record<
    string,
    {
      id: string
      type: string
      title: string
      artistName: string
      thumbnailUrl: string
      thumbnailWidth: number
      thumbnailHeight: number
      apiProvider: string
      platforms: string[]
    }
  >
  linksByPlatform: Record<
    string,
    {
      country: string
      url: string
      entityUniqueId: string
      nativeAppUriMobile?: string
      nativeAppUriDesktop?: string
    }
  >
}

const platformMapping: Record<string, string> = {
  spotify: "spotify",
  appleMusic: "apple-music",
  youtubeMusic: "youtube-music",
  soundcloud: "soundcloud",
  tidal: "tidal",
  deezer: "deezer",
  amazonMusic: "amazon-music",
  bandcamp: "bandcamp",
  lastfm: "last.fm", 
}

// Normalize string to help iTunes search find matches for complex names
const normalize = (str: string) => {
  return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Fallback: Extract metadata directly from Spotify's Open Graph tags
async function handleSpotifyFallback(url: string) {
  console.log("[resolve-link] Spotify fallback for:", url)
  
  // Only works for Spotify URLs
  if (!url.includes("spotify.com")) {
    return NextResponse.json({ 
      error: "Rate limited. Please try again in a few minutes." 
    }, { status: 429 })
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    })
    
    if (!response.ok) {
      throw new Error(`Spotify page fetch failed: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Extract Open Graph metadata
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/)
    
    let title = titleMatch?.[1] || ""
    const artworkUrl = imageMatch?.[1] || ""
    let artist = ""
    
    // Extract artist from description: "ArtistName · Song · Year"
    if (descMatch?.[1]) {
      const parts = descMatch[1].split(" · ")
      if (parts.length > 0) {
        artist = parts[0]
      }
    }
    
    // Determine type from URL
    const type = url.includes("/album/") ? "album" : "song"
    
    // Build platforms list with just Spotify
    const platforms: { platform: string; url: string }[] = [
      { platform: "spotify", url: url.split("?")[0] }, // Clean URL
      { platform: "meta_type", url: type }
    ]
    
    // Add Last.fm link
    if (artist && title) {
      const safeArtist = encodeURIComponent(artist).replace(/%20/g, "+")
      const safeTitle = encodeURIComponent(title).replace(/%20/g, "+")
      platforms.push({
        platform: "last.fm",
        url: `https://www.last.fm/music/${safeArtist}/_/${safeTitle}`
      })
    }
    
    // Try to get preview from iTunes
    const cleanQuery = `${normalize(title)} ${normalize(artist)}`
    try {
      const itunesResponse = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=5`
      )
      const itunesData = await itunesResponse.json()
      if (itunesData.resultCount > 0) {
        const match = itunesData.results.find((r: any) => r.previewUrl)
        if (match) {
          platforms.push({ platform: "preview", url: match.previewUrl })
        }
      }
    } catch (e) {}
    
    console.log("[resolve-link] Spotify fallback success:", { title, artist })
    
    return NextResponse.json({
      title,
      artist,
      artworkUrl,
      platforms,
    })
  } catch (error) {
    console.error("[resolve-link] Spotify fallback error:", error)
    return NextResponse.json({ 
      error: "Rate limited by music service. Please try again in a few minutes.",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 429 })
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  let initUrl = searchParams.get("url")

  if (!initUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  let url: string = initUrl
  console.log("[resolve-link] Processing URL:", initUrl)

  // 0. Check if we already have this link cached in database (bypass rate limiting)
  if (url.includes("spotify.com")) {
    try {
      const cached = await findCachedSongBySpotifyUrl(url)
      if (cached) {
        console.log("[resolve-link] Found cached song, skipping API call")
        return NextResponse.json({
          title: cached.title,
          artist: cached.artist,
          artworkUrl: cached.artworkUrl,
          platforms: cached.platforms.map(p => ({
            platform: p.platform,
            url: p.url
          }))
        })
      }
    } catch (e) {
      console.log("[resolve-link] Cache lookup failed, proceeding to API")
    }
  }

  try {
    // 1. Handle Last.fm Input
    if (url.includes("last.fm/music/")) {
      try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split("/").filter(Boolean)
        
        if (pathParts.length >= 2) {
          const artist = decodeURIComponent(pathParts[1].replace(/\+/g, " "))
          const segment2 = pathParts[2] ? decodeURIComponent(pathParts[2].replace(/\+/g, " ")) : null
          const segment3 = pathParts[3] ? decodeURIComponent(pathParts[3].replace(/\+/g, " ")) : null

          let query = ""
          let entity = "song"

          if (segment3) {
            query = `${artist} ${segment3}`
            entity = "song"
          } else if (segment2 && segment2 !== "_") {
            query = `${artist} ${segment2}`
            entity = "album"
          }

          if (query) {
             const itunesSearch = await fetch(
               `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=${entity}&limit=1`
             )
             const itunesData = await itunesSearch.json()
             if (itunesData.resultCount > 0) {
                const result = itunesData.results[0]
                url = result.trackViewUrl || result.collectionViewUrl || url
             }
          }
        }
      } catch (e) {
        console.warn("Failed to parse Last.fm URL", e)
      }
    }

    // 2. Resolve via Odesli
    console.log("[resolve-link] Calling Odesli API for:", url)
    
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    let response
    try {
      response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`, {
        headers: {
          "User-Agent": "MusicSmartLink/1.0",
          "Accept": "application/json"
        },
        signal: controller.signal
      })
      clearTimeout(timeoutId)
    } catch (fetchError) {
      clearTimeout(timeoutId)
      console.error("[resolve-link] Fetch error:", fetchError)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({ 
          error: "Request timed out. The music service is taking too long to respond.",
          details: "Timeout after 10s"
        }, { status: 504 })
      }
      
      throw fetchError
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read response")
      console.error("[resolve-link] Odesli API error:", response.status, errorText)
      
      // Rate limited - try Spotify fallback
      if (response.status === 429) {
        console.log("[resolve-link] Rate limited, trying Spotify fallback...")
        return await handleSpotifyFallback(url)
      }
      
      if (response.status === 404) {
        return NextResponse.json({ 
          error: "This link is not recognized as a music URL. Try a Spotify, Apple Music, or YouTube Music link." 
        }, { status: 400 })
      }
      throw new Error(`Odesli API error (${response.status}): ${errorText}`)
    }

    const data: SongLinkResponse = await response.json()
    const mainEntity = data.entitiesByUniqueId[data.entityUniqueId]

    if (!mainEntity) {
      throw new Error("Could not find main entity in response")
    }

    const title = mainEntity.title
    const artist = mainEntity.artistName
    const artworkUrl = mainEntity.thumbnailUrl
    const type = mainEntity.type 

    const platforms = Object.entries(data.linksByPlatform)
      .map(([key, linkData]) => {
        const platformId = platformMapping[key]
        if (!platformId) return null
        return {
          platform: platformId,
          url: linkData.url,
        }
      })
      .filter((p): p is { platform: string; url: string } => p !== null)

    // Inject Meta Type
    platforms.push({
        platform: "meta_type",
        url: type 
    })

    // 3. Ensure Last.fm Output
    if (artist && title) {
        const safeArtist = encodeURIComponent(artist).replace(/%20/g, "+")
        const safeTitle = encodeURIComponent(title).replace(/%20/g, "+")
        const lastFmUrl = `https://www.last.fm/music/${safeArtist}/_/${safeTitle}`

        const exists = platforms.find(p => p.platform === "last.fm")
        if (!exists) {
            platforms.push({
                platform: "last.fm",
                url: lastFmUrl
            })
        }
    }

    // 4. Previews (FIXED with Normalization)
    let previewUrl = null
    const cleanQuery = `${normalize(title)} ${normalize(artist)}`
    
    try {
        // Fetch 5 results to increase odds of finding one with a preview
        const itunesResponse = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQuery)}&media=music&entity=song&limit=5`
        )
        const itunesData = await itunesResponse.json()
        if (itunesData.resultCount > 0) {
            // Filter for the first one that has a previewUrl
            const match = itunesData.results.find((r: any) => r.previewUrl)
            if (match) previewUrl = match.previewUrl
        }
    } catch (e) {}

    if (previewUrl) {
      platforms.push({ platform: "preview", url: previewUrl })
    }

    return NextResponse.json({
      title,
      artist,
      artworkUrl,
      platforms,
    })
  } catch (error) {
    console.error("[resolve-link] Error:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    
    // Provide more specific error messages
    if (errorMessage.includes("fetch") || errorMessage.includes("ECONNREFUSED")) {
      return NextResponse.json({ 
        error: "Unable to connect to music services. Please try again later." 
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: "Failed to resolve this music link. Please check the URL or enter details manually.",
      details: errorMessage
    }, { status: 500 })
  }
}