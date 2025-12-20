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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const initUrl = searchParams.get("url")

  if (!initUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  let url: string = initUrl

  try {
    // Since Odesli doesn't support Last.fm input, we parse it, find the iTunes link, 
    // and use that to resolve the rest.
    if (url.includes("last.fm/music/")) {
      try {
        const urlObj = new URL(url)
        const pathParts = urlObj.pathname.split("/").filter(Boolean)
        // Expected format: ['music', 'Artist', 'AlbumOr_', 'Track']
        
        if (pathParts.length >= 2) {
          const artist = decodeURIComponent(pathParts[1].replace(/\+/g, " "))
          const segment2 = pathParts[2] ? decodeURIComponent(pathParts[2].replace(/\+/g, " ")) : null
          const segment3 = pathParts[3] ? decodeURIComponent(pathParts[3].replace(/\+/g, " ")) : null

          let query = ""
          let entity = "song"

          if (segment3) {
            // Structure: /music/Artist/Album/Track OR /music/Artist/_/Track
            query = `${artist} ${segment3}`
            entity = "song"
          } else if (segment2 && segment2 !== "_") {
            // Structure: /music/Artist/Album
            query = `${artist} ${segment2}`
            entity = "album"
          } else {
             // Just artist? Not supported for smart links usually, but we can try generic song search
             // Or structure: /music/Artist/_ (Rare)
          }

          if (query) {
             // Find matching iTunes link to serve as our "Source" for Odesli
             const itunesSearch = await fetch(
               `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=${entity}&limit=1`
             )
             const itunesData = await itunesSearch.json()
             
             if (itunesData.resultCount > 0) {
                const result = itunesData.results[0]
                // Swap the Last.fm URL for the Apple Music URL
                // This allows Odesli to find Spotify, Youtube, etc.
                url = result.trackViewUrl || result.collectionViewUrl || url
             }
          }
        }
      } catch (e) {
        console.warn("Failed to parse Last.fm URL, attempting direct resolve...", e)
      }
    }

    // --- Odesli way ---
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

    // Re-generate the Last.fm link if it wasn't returned
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

    // --- PREVIEWS & ALBUM TRACKS ---
    let previewUrl = null
    let tracks: any[] = []

    if (type === "album") {
      try {
        const appleLink = data.linksByPlatform["appleMusic"]?.url
        let appleId = null

        if (appleLink) {
          const match = appleLink.match(/\/(\d+)(\?|$)/)
          if (match) appleId = match[1]
        }

        if (!appleId) {
            const searchRes = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(title + " " + artist)}&media=music&entity=album&limit=1`
            )
            const searchData = await searchRes.json()
            if (searchData.resultCount > 0) {
                appleId = searchData.results[0].collectionId
            }
        }

        if (appleId) {
          const lookupRes = await fetch(
            `https://itunes.apple.com/lookup?id=${appleId}&entity=song&limit=200`
          )
          const lookupData = await lookupRes.json()
          
          if (lookupData.resultCount > 1) {
             const albumTracks = lookupData.results.filter((item: any) => item.wrapperType === 'track')
             tracks = albumTracks.map((t: any) => ({
                title: t.trackName,
                artist: t.artistName,
                duration: ((t.trackTimeMillis % 60000) / 1000).toFixed(0).padStart(2, '0'),
                preview_url: t.previewUrl,
                track_number: t.trackNumber
             }))
             if (tracks.length > 0) previewUrl = tracks[0].preview_url
          }
        }
      } catch (err) { console.error(err) }
    } 
    
    if (!previewUrl && tracks.length === 0) {
        const query = `${title} ${artist}`
        try {
            const itunesResponse = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
            )
            const itunesData = await itunesResponse.json()
            if (itunesData.resultCount > 0) {
                previewUrl = itunesData.results[0].previewUrl
            }
        } catch (e) {}
    }

    if (previewUrl) {
      platforms.push({ platform: "preview", url: previewUrl })
    }

    return NextResponse.json({
      title,
      artist,
      artworkUrl,
      platforms,
      tracks,
    })
  } catch (error) {
    console.error("Resolve link error:", error)
    return NextResponse.json({ error: "Failed to resolve link metadata" }, { status: 500 })
  }
}