"use client"

import { ExternalLink, Copy, Check, ArrowLeft, Play, Pause, Volume2, VolumeX, Volume1 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"

interface SmartLink {
  id: string
  slug: string
  title: string
  artist: string | null
  artwork_url: string | null
}

interface PlatformLink {
  id: string
  platform: string
  url: string
}

interface SmartLinkViewerProps {
  smartLink: SmartLink
  platformLinks: PlatformLink[]
}

const platformLogos: Record<string, string> = {
  spotify: "/spotify.svg",
  "apple-music": "/apple_music.svg",
  "youtube-music": "/youtube_music.svg",
  soundcloud: "/soundcloud.svg",
  tidal: "/tidal.svg",
  deezer: "/deezer.svg",
  "amazon-music": "/amazon_music.svg",
  bandcamp: "/bandcamp.svg",
}

const platformColors: Record<string, string> = {
  spotify: "bg-green-600",
  "apple-music": "bg-pink-600",
  "youtube-music": "bg-red-600",
  soundcloud: "bg-orange-600",
  tidal: "bg-blue-600",
  deezer: "bg-purple-600",
  "amazon-music": "bg-cyan-600",
  bandcamp: "bg-teal-600",
}

export default function SmartLinkViewer({ smartLink, platformLinks }: SmartLinkViewerProps) {
  const [copied, setCopied] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.25)
  const [isMuted, setIsMuted] = useState(false)
  const [isDraggingTime, setIsDraggingTime] = useState(false)
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const volumeBarRef = useRef<HTMLDivElement>(null)

  const spotifyLink = platformLinks.find((link) => link.platform === "spotify")
  const spotifyTrackId = spotifyLink ? spotifyLink.url.match(/track\/([a-zA-Z0-9]+)/)?.[1] : null

  const previewLink = platformLinks.find((link) => link.platform === "preview")
  // Use the preview link provided by iTunes/Deezer
  const audioSrc = previewLink ? previewLink.url : null

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        try {
          await audioRef.current.play()
          setIsPlaying(true)
        } catch (err) {
          console.error("Audio playback failed:", err)
          setAudioError(true)
          setIsPlaying(false)
        }
      }
    }
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Global mouse handlers for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTime && progressBarRef.current && audioRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = Math.min(Math.max(x / rect.width, 0), 1)
        const duration = audioRef.current.duration || 1

        const newTime = percentage * duration
        if (Number.isFinite(newTime)) {
          audioRef.current.currentTime = newTime
          setProgress(percentage * 100)
        }
      }

      if (isDraggingVolume && volumeBarRef.current) {
        const rect = volumeBarRef.current.getBoundingClientRect()
        const y = rect.bottom - e.clientY
        const percentage = Math.min(Math.max(y / rect.height, 0), 1)

        setVolume(percentage)
        setIsMuted(percentage === 0)
      }
    }

    const handleMouseUp = () => {
      setIsDraggingTime(false)
      setIsDraggingVolume(false)
    }

    if (isDraggingTime || isDraggingVolume) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDraggingTime, isDraggingVolume])

  const handleTimeUpdate = () => {
    // Don't update progress while dragging to prevent jitter
    if (audioRef.current && !isDraggingTime) {
      const current = audioRef.current.currentTime
      const duration = audioRef.current.duration || 1
      setProgress((current / duration) * 100)
    }
  }

  const handleTimeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingTime(true)
    // Instant update on click
    if (audioRef.current && progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = Math.min(Math.max(x / rect.width, 0), 1)
      const duration = audioRef.current.duration || 1
      const newTime = percentage * duration

      if (Number.isFinite(newTime)) {
        audioRef.current.currentTime = newTime
        setProgress(percentage * 100)
      }
    }
  }

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVolume(true)
    // Instant update on click
    if (volumeBarRef.current) {
      const rect = volumeBarRef.current.getBoundingClientRect()
      const y = rect.bottom - e.clientY
      const percentage = Math.min(Math.max(y / rect.height, 0), 1)

      setVolume(percentage)
      setIsMuted(percentage === 0)
    }
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsMuted(!isMuted)
  }

  const formatPlatformName = (platform: string) => {
    return platform
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl opacity-20 float-animation" />
      <div
        className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-red-700/10 rounded-full blur-3xl opacity-20 float-animation"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-4">
        <Card className="glass-card shadow-2xl border-white/10 p-6 reveal-animation" style={{ animationDelay: "0.2s" }}>
          {smartLink.artwork_url ? (
            <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/10 group">
              <Image
                src={smartLink.artwork_url || "/placeholder.svg"}
                alt={smartLink.title}
                width={192}
                height={192}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                crossOrigin="anonymous"
              />

              {audioSrc && !audioError && (
                <>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                    <button
                      onClick={togglePlay}
                      className="w-14 h-14 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/30 hover:scale-105 transition-all duration-200 shadow-xl"
                      aria-label={isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white fill-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      )}
                    </button>

                    {/* Volume Control - Vertical Popover */}
                    <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2 group/volume z-20" onClick={(e) => e.stopPropagation()}>
                      {/* Slider Container - Hidden by default, reveals on hover */}
                      <div className="h-0 overflow-hidden group-hover/volume:h-24 transition-all duration-300 flex flex-col justify-end items-center mb-1 opacity-0 group-hover/volume:opacity-100">
                        <div
                          className="w-1.5 h-20 bg-black/20 backdrop-blur-md rounded-full relative cursor-pointer group/slider"
                          onMouseDown={handleVolumeMouseDown}
                          ref={volumeBarRef}
                        >
                          {/* Track */}
                          <div className="absolute inset-0 bg-white/20 rounded-full" />
                          {/* Fill */}
                          <div
                            className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all duration-75"
                            style={{ height: `${isMuted ? 0 : volume * 100}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-all backdrop-blur-md shadow-sm"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4" />
                        ) : volume < 0.5 ? (
                          <Volume1 className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Timeline - Bottom */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 cursor-pointer group/timeline hover:h-2 transition-all duration-200"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={handleTimeMouseDown}
                    ref={progressBarRef}
                  >
                    <div
                      className="h-full bg-white/40 w-full absolute top-0 left-0"
                    />
                    <div
                      className="h-full bg-red-500 relative transition-all duration-100 ease-linear"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full scale-0 group-hover/timeline:scale-100 transition-transform shadow-sm" />
                    </div>
                  </div>
                </>
              )}

              {/* Explicit audio element, hidden but functional */}
              {audioSrc && (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => setAudioError(true)}
                />
              )}
            </div>
          ) : (
            <div className="relative w-48 h-48 mx-auto rounded-2xl bg-gradient-to-br from-red-600/10 to-red-700/10 flex items-center justify-center mb-6 shadow-2xl shadow-black/20 backdrop-blur-xl ring-1 ring-white/5 group">
              <span className="text-6xl text-red-500/30">🎵</span>

              {audioSrc && !audioError && (
                <>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm rounded-2xl overflow-hidden">
                    <button
                      onClick={togglePlay}
                      className="w-14 h-14 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/30 hover:scale-105 transition-all duration-200 shadow-xl"
                      aria-label={isPlaying ? "Pause preview" : "Play preview"}
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white fill-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                      )}
                    </button>

                    {/* Volume Control - Top Right */}
                    <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2 group/volume z-20" onClick={(e) => e.stopPropagation()}>
                      {/* Slider Container - Hidden by default, reveals on hover */}
                      <div className="h-0 overflow-hidden group-hover/volume:h-24 transition-all duration-300 flex flex-col justify-end items-center mb-1 opacity-0 group-hover/volume:opacity-100">
                        <div
                          className="w-1.5 h-20 bg-black/20 backdrop-blur-md rounded-full relative cursor-pointer group/slider"
                          onMouseDown={handleVolumeMouseDown}
                          ref={volumeBarRef}
                        >
                          {/* Track */}
                          <div className="absolute inset-0 bg-white/20 rounded-full" />
                          {/* Fill */}
                          <div
                            className="absolute bottom-0 left-0 w-full bg-white rounded-full transition-all duration-75"
                            style={{ height: `${isMuted ? 0 : volume * 100}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-all backdrop-blur-md shadow-sm"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4" />
                        ) : volume < 0.5 ? (
                          <Volume1 className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Timeline - Bottom */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 cursor-pointer group/timeline hover:h-2 transition-all duration-200"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={handleTimeMouseDown}
                      ref={progressBarRef} // Re-using ref might be tricky if both exist, but conditional rendering prevents collision
                    >
                      <div
                        className="h-full bg-white/40 w-full absolute top-0 left-0"
                      />
                      <div
                        className="h-full bg-red-500 relative transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full scale-0 group-hover/timeline:scale-100 transition-transform shadow-sm" />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* Explicit audio element for fallback case */}
              {audioSrc && !smartLink.artwork_url && (
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  crossOrigin="anonymous"
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onError={() => setAudioError(true)}
                />
              )}
            </div>
          )}

          <div className={`text-center space-y-1 ${audioSrc ? "mb-6" : "mb-3"}`}>
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight text-balance">
              {smartLink.title}
            </h1>
            {smartLink.artist && <p className="text-base text-white/50 font-light">{smartLink.artist}</p>}
          </div>

          <div className="space-y-2">
            {platformLinks
              .filter(link => link.platform !== "preview")
              .map((link, index) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                  style={{ animationDelay: `${0.3 + index * 0.1}s` }}
                >
                  <div
                    className={`platform-button h-10 px-4 rounded-lg backdrop-blur-xl border transition-all duration-200 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] ${platformColors[link.platform] || "bg-red-600"}`}
                    data-platform={link.platform}
                  >
                    <div className="flex items-center gap-3">
                      {platformLogos[link.platform] && (
                        <Image
                          src={platformLogos[link.platform] || "/placeholder.svg"}
                          alt={link.platform}
                          width={24}
                          height={24}
                          className="w-5 h-5 brightness-0 invert"
                        />
                      )}
                      <span className="text-sm font-medium text-white">{formatPlatformName(link.platform)}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
          </div>
        </Card>

        <div className="text-center reveal-animation" style={{ animationDelay: "0.6s" }}>
          <Link
            href="/"
            className="text-xs text-white/40 hover:text-white/70 transition-colors font-light inline-flex items-center gap-2 group"
          >
            Create your own
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
