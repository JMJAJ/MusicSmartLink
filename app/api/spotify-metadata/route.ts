import { type NextRequest, NextResponse } from "next/server"

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string) {
  if (!text) return ""
  
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Handle Decimal Entities (e.g. &#39;)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    // Handle Hex Entities (e.g. &#x27; -> ')
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Handle the specific spaced edge case you saw if necessary
    .replace(/&#x27\s*;?/g, "'")
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get("url")

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Spotify page: ${response.status}`)
    }

    const html = await response.text()

    // Extract Open Graph metadata
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/)
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/)
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/)
    const spotifyUriMatch = html.match(/<meta property="og:url" content="([^"]+)"/)

    // Extract Track ID
    let trackId = ""
    const urlTrackMatch = (spotifyUriMatch?.[1] || url).match(/track\/([a-zA-Z0-9]+)/)
    if (urlTrackMatch) {
      trackId = urlTrackMatch[1]
    }

    // Extract raw strings
    let title = titleMatch ? titleMatch[1] : ""
    const artworkUrl = imageMatch ? imageMatch[1] : ""
    let artist = ""

    // Strategy: Extract Artist from Description
    // Format: "ArtistName · Song · Year"
    if (descMatch && descMatch[1]) {
      const desc = descMatch[1]
      const parts = desc.split(" · ")
      if (parts.length > 0) {
        artist = parts[0]
      }
    }

    // Fallback: Extract from Title
    if (!artist) {
      const pageTitleMatch = html.match(/<title>(.*?)<\/title>/)
      if (pageTitleMatch && pageTitleMatch[1]) {
        const pageTitle = pageTitleMatch[1]
        const songByMatch = pageTitle.match(/- song by (.*?) \| Spotify/)
        if (songByMatch && songByMatch[1]) {
          artist = songByMatch[1]
        }
      }
    }

    // Clean HTML entities from the extracted strings
    title = decodeHtmlEntities(title)
    artist = decodeHtmlEntities(artist)

    console.log("[API] Extracted metadata:", { title, artist, artworkUrl, trackId })

    return NextResponse.json({
      title,
      artist,
      artworkUrl,
      trackId,
    })
  } catch (error) {
    console.error("[API] Spotify metadata fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch track metadata" }, { status: 500 })
  }
}