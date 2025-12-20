import { type NextRequest, NextResponse } from "next/server"

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = ((ms % 60000) / 1000).toFixed(0)
  return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const title = searchParams.get("title")
  const artist = searchParams.get("artist") || ""
  const type = searchParams.get("type")

  // 1. Strict Guard: If the frontend explicitly detected a "Song" link 
  // (e.g. spotify.com/track/...), do NOT fetch tracks.
  if (type === "song") {
    return NextResponse.json({ tracks: [] })
  }

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  try {
    const query = `${title} ${artist}`
    let collectionId = null
    
    // STRATEGY A: Direct Album Search
    // Works best for EPs and LPs
    const albumSearchRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`
    )
    const albumData = await albumSearchRes.json()

    if (albumData.resultCount > 0) {
      collectionId = albumData.results[0].collectionId
    } 
    
    // STRATEGY B: Fallback Song Search
    // If Album search failed (common for Single Releases), search for the song 
    // and grab the album (collection) it belongs to.
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

    // 2. Fetch the Tracklist using the Collection ID
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
    console.error("[API] Error fetching album tracks:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}