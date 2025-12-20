"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Music, Loader2, Sparkles, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface PlatformLink {
  id: string
  platform: string
  url: string
}

interface SpotifyTrackData {
  title: string
  artist: string
  artworkUrl: string
}

export default function HomePage() {
  // --- Prevent FOUC (Flash of Unstyled Content) ---
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  const router = useRouter()
  const [sourceLink, setSourceLink] = useState("")
  const [title, setTitle] = useState("")
  const [artist, setArtist] = useState("")
  const [artworkUrl, setArtworkUrl] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [platformLinks, setPlatformLinks] = useState<PlatformLink[]>([
    { id: "initial-id", platform: "", url: "" },
  ])
  const [isCreating, setIsCreating] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLinkData = async (url: string) => {
    setIsFetching(true)
    setError(null)

    try {
      const response = await fetch(`/api/resolve-link?url=${encodeURIComponent(url)}`)

      if (!response.ok) {
        throw new Error("Failed to fetch track data")
      }

      const data = await response.json()

      setTitle(data.title || "")
      setArtist(data.artist || "")
      setArtworkUrl(data.artworkUrl || "")

      if (data.platforms && Array.isArray(data.platforms)) {
        const preview = data.platforms.find((p: any) => p.platform === "preview")
        if (preview) {
          setPreviewUrl(preview.url)
        }

        const newLinks = data.platforms
          .filter((p: any) => p.platform !== "preview")
          .map((p: any) => ({
            id: crypto.randomUUID(),
            platform: p.platform,
            url: p.url,
          }))

        // Sort to prioritize common platforms
        const priority = ["spotify", "apple-music", "youtube-music", "soundcloud"]
        newLinks.sort((a: any, b: any) => {
          const indexA = priority.indexOf(a.platform)
          const indexB = priority.indexOf(b.platform)
          if (indexA !== -1 && indexB !== -1) return indexA - indexB
          if (indexA !== -1) return -1
          if (indexB !== -1) return 1
          return 0
        })

        setPlatformLinks(newLinks)
      }
    } catch (err) {
      console.error(err)
      setError("Could not fetch track data. Please enter details manually.")
    } finally {
      setIsFetching(false)
    }
  }

  const handleSourceLinkChange = (value: string) => {
    setSourceLink(value)

    if (value.length > 10 && (value.startsWith("http://") || value.startsWith("https://"))) {
      try {
        new URL(value)
        fetchLinkData(value)
      } catch (e) {
        // invalid url
      }
    }
  }

  const addPlatform = () => {
    setPlatformLinks([...platformLinks, { id: crypto.randomUUID(), platform: "", url: "" }])
  }

  const removePlatform = (id: string) => {
    if (platformLinks.length > 1) {
      setPlatformLinks(platformLinks.filter((p) => p.id !== id))
    }
  }

  const updatePlatform = (id: string, field: "platform" | "url", value: string) => {
    setPlatformLinks(platformLinks.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const generateSlug = (title: string) => {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 8)
    )
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    setError(null)

    try {
      const slug = generateSlug(title)

      const linkResponse = await fetch("/api/smart-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          artist,
          artwork_url: artworkUrl || null,
          platforms: [
            ...platformLinks.filter((p) => p.platform && p.url),
            ...(previewUrl ? [{ platform: "preview", url: previewUrl }] : [])
          ],
        }),
      })

      if (!linkResponse.ok) {
        throw new Error("Failed to create smart link")
      }

      const data = await linkResponse.json()
      router.push(`/${data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const platforms = [
    "Spotify",
    "Apple Music",
    "YouTube Music",
    "SoundCloud",
    "Tidal",
    "Deezer",
    "Amazon Music",
    "Bandcamp",
  ]

  // Don't render until client-side hydration is complete
  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-red-700/5 rounded-full blur-3xl opacity-30" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 backdrop-blur-xl flex items-center justify-center border border-red-500/20">
              <Music className="w-4 h-4 text-red-500" strokeWidth={2} />
            </div>
            <h1 className="text-2xl font-semibold text-white/90">Smart Link</h1>
          </div>
          <p className="text-sm text-white/40 font-light">Share your music everywhere</p>
        </div>

        <div className="glass-card shadow-xl border-white/10 p-6 space-y-5">
          <form onSubmit={handleCreateLink} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sourceLink" className="text-white/70 font-medium text-xs">
                Music Link
                <span className="text-white/40 ml-1 font-normal">Auto-fill all platforms</span>
              </Label>
              <Input
                id="sourceLink"
                type="url"
                value={sourceLink}
                onChange={(e) => handleSourceLinkChange(e.target.value)}
                placeholder="Paste a link from Spotify, Apple Music, etc..."
                disabled={isFetching}
                className="glass-input text-white placeholder:text-white/30 h-10 text-sm border-white/10"
              />
              {isFetching && (
                <p className="text-xs text-white/50 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Finding other platforms...
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white/70 font-medium text-xs">
                  Track Title
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter track name"
                  required
                  className="glass-input text-white placeholder:text-white/30 h-10 text-sm border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist" className="text-white/70 font-medium text-xs">
                  Artist Name
                </Label>
                <Input
                  id="artist"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="Enter artist name"
                  className="glass-input text-white placeholder:text-white/30 h-10 text-sm border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="artwork" className="text-white/70 font-medium text-xs">
                  Artwork URL
                  <span className="text-white/40 ml-1 font-normal">Optional</span>
                </Label>
                <Input
                  id="artwork"
                  type="url"
                  value={artworkUrl}
                  onChange={(e) => setArtworkUrl(e.target.value)}
                  placeholder="https://..."
                  className="glass-input text-white placeholder:text-white/30 h-10 text-sm border-white/10"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white/70 font-medium text-xs">Platform Links</Label>
                <Button
                  type="button"
                  onClick={addPlatform}
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/5"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {platformLinks.map((platform) => (
                  <div key={platform.id} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <select
                        value={platform.platform}
                        onChange={(e) => updatePlatform(platform.id, "platform", e.target.value)}
                        className="glass-input text-white text-sm px-3 h-10 rounded-lg border-white/10"
                        required
                      >
                        <option value="">Platform</option>
                        {platforms.map((p) => (
                          <option key={p} value={p.toLowerCase().replace(/\s+/g, "-")}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="url"
                        value={platform.url}
                        onChange={(e) => updatePlatform(platform.id, "url", e.target.value)}
                        placeholder="https://..."
                        className="glass-input text-white placeholder:text-white/30 h-10 text-sm border-white/10"
                        required
                      />
                    </div>
                    {platformLinks.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removePlatform(platform.id)}
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 hover:bg-red-500/10 hover:text-red-400 text-white/30"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
            )}

            <Button
              type="submit"
              disabled={isCreating}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-10 text-sm shadow-lg transition-all duration-200"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Smart Link
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs">Free forever. No signup required.</p>
      </div>
    </div>
  )
}