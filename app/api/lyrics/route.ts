import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const trackName = searchParams.get("track")
    const artistName = searchParams.get("artist")
    const albumName = searchParams.get("album")
    const duration = searchParams.get("duration")

    if (!trackName || !artistName) {
      return NextResponse.json(
        { error: "Track name and artist name are required" },
        { status: 400 }
      )
    }

    // Build LRCLib API URL
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    })
    
    if (albumName) params.append("album_name", albumName)
    if (duration) params.append("duration", duration)

    const lrcLibUrl = `https://lrclib.net/api/get?${params.toString()}`

    const response = await fetch(lrcLibUrl, {
      headers: {
        "User-Agent": "SmartLink/1.0.0",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { syncedLyrics: null, plainLyrics: null },
          { status: 200 }
        )
      }
      throw new Error(`LRCLib API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      syncedLyrics: data.syncedLyrics || null,
      plainLyrics: data.plainLyrics || null,
    })
  } catch (error) {
    console.error("[Lyrics API] Error:", error)
    // Return empty lyrics instead of error to avoid breaking the UI
    return NextResponse.json(
      { syncedLyrics: null, plainLyrics: null },
      { status: 200 }
    )
  }
}
