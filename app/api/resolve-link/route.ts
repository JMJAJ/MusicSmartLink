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
    // bandcamp is not always strictly returned by Odesli in the same key, but often is 'bandcamp' if found. 
    // Odesli returns 'bandcamp' as key too if present.
    bandcamp: "bandcamp",
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get("url")

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    try {
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

        // Attempt to fetch a preview URL (iTunes first, then Deezer)
        let previewUrl = null
        const query = `${title} ${artist}`

        // 1. Try iTunes
        try {
            const itunesResponse = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=1`
            )
            if (itunesResponse.ok) {
                const itunesData = await itunesResponse.json()
                if (itunesData.resultCount > 0 && itunesData.results[0].previewUrl) {
                    previewUrl = itunesData.results[0].previewUrl
                    console.log("Found iTunes preview")
                }
            }
        } catch (err) {
            console.error("iTunes preview fetch failed:", err)
        }

        // 2. Try Deezer if no preview yet
        if (!previewUrl) {
            try {
                const deezerResponse = await fetch(
                    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`
                )
                if (deezerResponse.ok) {
                    const deezerData = await deezerResponse.json()
                    if (deezerData.data && deezerData.data.length > 0 && deezerData.data[0].preview) {
                        previewUrl = deezerData.data[0].preview
                        console.log("Found Deezer preview")
                    }
                }
            } catch (err) {
                console.error("Deezer preview fetch failed:", err)
            }
        }

        if (previewUrl) {
            platforms.push({
                platform: "preview",
                url: previewUrl
            })
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
