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

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  // Clean inputs
  const cleanTitle = normalize(title)
  const cleanArtist = normalize(artist)
  const query = `${cleanTitle} ${cleanArtist}`

  try {
    // FIX: If it's explicitly a song, search for it and return as a single item tracklist.
    // This repairs broken "no-preview" links without triggering Album view.
    if (type === "song") {
        const songRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
        )
        const songData = await songRes.json()
        
        if (songData.resultCount > 0) {
            const t = songData.results[0]
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
        return NextResponse.json({ tracks: [] })
    }

    // --- Album Logic ---
    let collectionId = null
    
    // 1. Precise Album Search
    const albumSearchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`
    )
    const albumData = await albumSearchRes.json()

    if (albumData.resultCount > 0) {
      collectionId = albumData.results[0].collectionId
    } 
    
    // 2. Loose Album Search
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

    // 3. Fallback Song Search (for Single Releases that are actually albums)
    if (!collectionId) {
      const songSearchRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
      )
      const songData = await songSearchRes.json()
      if (songData.resultCount > 0) {
        collectionId = songData.results[0].collectionId
      }
    }

    if (!collectionId) {
      return NextResponse.json({ tracks: [] })
    }

    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
    )
    const lookupData = await lookupRes.json()
    
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