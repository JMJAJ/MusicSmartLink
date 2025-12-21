import { type NextRequest, NextResponse } from "next/server"

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

// FIX: Normalize string to help iTunes search find matches for complex names
const normalize = (str: string) => {
  return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  let initUrl = searchParams.get("url")

  if (!initUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  let url: string = initUrl

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
    const response = await fetch(`https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch link data: ${response.status}`)
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
    console.error("Resolve link error:", error)
    return NextResponse.json({ error: "Failed to resolve link metadata" }, { status: 500 })
  }
}