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
  const type = searchParams.get("type") // New Parameter

  // 1. STOP if this is explicitly a song.
  // This prevents finding the "Album" version of a "Single" with the same name.
  if (type === "song") {
    return NextResponse.json({ tracks: [] })
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  try {
    const query = `${title} ${artist}`
    let collectionId = null
    
    // Search for Album specifically
    const albumSearchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`
    )
    const albumData = await albumSearchRes.json()

    if (albumData.resultCount > 0) {
      collectionId = albumData.results[0].collectionId
    } 

    if (!collectionId) {
      return NextResponse.json({ tracks: [] })
    }

    // Lookup tracks
    const lookupRes = await fetch(
      `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&limit=200`
    )
    const lookupData = await lookupRes.json()
    
    // Filter out collection wrapper
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
    console.error("[API] Error fetching album tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}