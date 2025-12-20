import { type NextRequest, NextResponse } from "next/server"

// Helper: Format ms to mm:ss
const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const title = searchParams.get("title")
  const artist = searchParams.get("artist") || ""

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  try {
    let collectionId = null
    const query = `${title} ${artist}`
    
    // STRATEGY 1: Search for an Album entity directly
    const albumSearchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`
    )
    const albumData = await albumSearchRes.json()

    if (albumData.resultCount > 0) {
      collectionId = albumData.results[0].collectionId
    } 
    else {
      // STRATEGY 2: Fallback - Search for a Song, then get its Album ID
      // (Useful if the "Album" title is slightly different or it's an EP/Single)
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

    // 3. Lookup the Collection (Album) details to get all tracks
    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
    )
    const lookupData = await lookupRes.json()
    
    // Filter to keep only the tracks (remove the collection info wrapper)
    const rawTracks = lookupData.results.filter((item: any) => item.wrapperType === 'track')
    
    // Map to simple format
    const tracks = rawTracks.map((t: any) => ({
      id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      duration: formatDuration(t.trackTimeMillis),
      preview_url: t.previewUrl,
    }))

    return NextResponse.json({ tracks })

  } catch (error) {
    console.error("[API] Error fetching album tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}