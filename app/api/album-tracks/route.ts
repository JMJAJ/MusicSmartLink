import { type NextRequest, NextResponse } from "next/server"

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`
}

const normalize = (str: string) => {
  return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const title = searchParams.get("title")
  const artist = searchParams.get("artist") || ""
  const type = searchParams.get("type")
  const appleId = searchParams.get("appleId")

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  // Clean inputs
  const cleanTitle = normalize(title)
  const cleanArtist = normalize(artist)
  const query = `${cleanTitle} ${cleanArtist}`

  try {
    let collectionId = null

    // ---------------------------------------------------------
    // STRATEGY 1: Direct Apple ID Lookup (Highest Precision)
    // ---------------------------------------------------------
    if (appleId) {
      const lookupRes = await fetch(`https://itunes.apple.com/lookup?id=${appleId}&entity=song`)
      const data = await lookupRes.json()

      if (data.resultCount > 0) {
        const result = data.results[0]
        
        // If the ID points directly to a song, return it immediately (Fixes "Dying" preview issue)
        if (result.kind === 'song' || result.wrapperType === 'track') {
          return NextResponse.json({
            tracks: [{
              id: String(result.trackId),
              title: result.trackName,
              artist: result.artistName,
              duration: formatDuration(result.trackTimeMillis),
              preview_url: result.previewUrl,
            }]
          })
        }
        
        // If the ID points to an album/collection, save the ID for later
        if (result.wrapperType === 'collection') {
          collectionId = result.collectionId
        }
      }
    }

    // ---------------------------------------------------------
    // STRATEGY 2: Text Search (If ID failed or wasn't provided)
    // ---------------------------------------------------------

    // A. Explicit Single Track Text Search
    // Only do this if we haven't found a collectionId yet AND the user explicitly asked for a song
    if (!collectionId && type === "song") {
        const songRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=5`
        )
        const songData = await songRes.json()
        
        if (songData.resultCount > 0) {
            // Find the first track that actually has a preview
            const t = songData.results.find((r: any) => r.previewUrl) || songData.results[0]
            
            return NextResponse.json({
                tracks: [{
                    id: String(t.trackId),
                    title: t.trackName,
                    artist: t.artistName,
                    duration: formatDuration(t.trackTimeMillis),
                    preview_url: t.previewUrl,
                }]
            })
        }
        // If song search fails, fall through to try and find it as an album (edge case)
    }

    // B. Album / Collection Search Logic
    if (!collectionId) {
        // 1. Precise Album Search
        const albumSearchRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`
        )
        const albumData = await albumSearchRes.json()
        if (albumData.resultCount > 0) {
            collectionId = albumData.results[0].collectionId
        }
    }
    
    // 2. Loose Album Search (Filter by Artist)
    if (!collectionId) {
        const looseRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&media=music&entity=album&limit=15`
        )
        const looseData = await looseRes.json()
        const match = looseData.results.find((r: any) => {
            const resultArtist = normalize(r.artistName)
            return resultArtist.includes(cleanArtist) || cleanArtist.includes(resultArtist)
        })
        if (match) collectionId = match.collectionId
    }

    // 3. Fallback Song Search (To find the Album ID of a Single)
    // Often "Singles" are stored as Albums in backend, but searching entity=album fails.
    // Searching entity=song returns the track, which contains the correct collectionId.
    if (!collectionId) {
      const songSearchRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
      )
      const songData = await songSearchRes.json()
      if (songData.resultCount > 0) {
        collectionId = songData.results[0].collectionId
      }
    }

    // ---------------------------------------------------------
    // STRATEGY 3: Fetch Full Tracklist (If we have a Collection ID)
    // ---------------------------------------------------------
    if (!collectionId) {
      return NextResponse.json({ tracks: [] })
    }

    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
    )
    const lookupData = await lookupRes.json()
    
    // Filter out the collection object, keep only tracks
    const rawTracks = lookupData.results.filter((item: any) => item.wrapperType === 'track')
    
    const tracks = rawTracks.map((t: any) => ({
      id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      duration: formatDuration(t.trackTimeMillis),
      preview_url: t.previewUrl,
    }))

    return NextResponse.json({ tracks })

  } catch (error) {
    console.error("[API] Error fetching tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}