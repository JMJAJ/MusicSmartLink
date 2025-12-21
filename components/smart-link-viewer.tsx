"use client"

import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Music2,
  Disc,
  Clock,
  Loader2,
  X,
  ListMusic
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"

export interface Track {
  id: string
  title: string
  artist?: string
  duration?: string
  preview_url?: string | null
}

export interface SmartLink {
  id: string
  slug: string
  title: string
  artist: string | null
  artwork_url: string | null
  tracks?: Track[] 
}

export interface PlatformLink {
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
  "last.fm": "/last_fm.svg",
  lastfm: "/last_fm.svg",
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
  "last.fm": "bg-[#b90000]",
  lastfm: "bg-[#b90000]",
}

export default function SmartLinkViewer({ smartLink, platformLinks }: SmartLinkViewerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  
  const [tracks, setTracks] = useState<Track[]>(smartLink.tracks || [])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  const leftCardRef = useRef<HTMLDivElement>(null)
  const [rightCardHeight, setRightCardHeight] = useState<number | undefined>(undefined)

  const releaseType = useMemo(() => {
    const meta = platformLinks.find(p => p.platform === 'meta_type')
    if (meta) return meta.url

    const spotify = platformLinks.find(p => p.platform === 'spotify')
    if (spotify) {
        if (spotify.url.includes('/track/')) return 'song'
        if (spotify.url.includes('/album/')) return 'album'
    }
    const apple = platformLinks.find(p => p.platform === 'apple-music')
    if (apple && apple.url.includes('i=')) return 'song'
    
    const deezer = platformLinks.find(p => p.platform === 'deezer')
    if (deezer && deezer.url.includes('/track/')) return 'song'
    
    return 'album' 
  }, [platformLinks])

  // View Logic
  const hasTracks = tracks.length > 0
  const isAlbumMode = releaseType === 'album' || tracks.length > 1
  const showAlbumView = hasTracks && isAlbumMode && isSidebarOpen

  // Resize Observer
  useEffect(() => {
    if (!showAlbumView || !leftCardRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (window.innerWidth >= 768) {
          const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
          setRightCardHeight(Math.min(height, 700))
        } else {
          setRightCardHeight(undefined)
        }
      }
    })
    observer.observe(leftCardRef.current)
    return () => observer.disconnect()
  }, [showAlbumView, tracks.length])

  // Fetch Logic
  useEffect(() => {
    if (tracks.length > 0) return;
    
    // FIX: Only skip fetching for "song" IF we already have a preview.
    // If preview is missing, let it fetch so we can populate the player.
    const hasGlobalPreview = !!platformLinks.find(l => l.platform === 'preview')
    if (releaseType === 'song' && hasGlobalPreview) return;

    if (smartLink.title && smartLink.artist) {
      const fetchTracks = async () => {
        setIsLoadingTracks(true)
        try {
          const res = await fetch(`/api/album-tracks?title=${encodeURIComponent(smartLink.title)}&artist=${encodeURIComponent(smartLink.artist || "")}&type=${releaseType}`)
          const data = await res.json()
          
          if (data.tracks && Array.isArray(data.tracks)) {
            setTracks(data.tracks)
            if (data.tracks.length > 0 && releaseType !== 'song') setIsSidebarOpen(true)
          }
        } catch (error) {
          console.error("Failed to load album tracks", error)
        } finally {
          setIsLoadingTracks(false)
        }
      }
      fetchTracks()
    }
  }, [smartLink.title, smartLink.artist, tracks.length, releaseType, platformLinks])

  // --- Audio State ---
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [audioError, setAudioError] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.25) 
  const [isMuted, setIsMuted] = useState(false)
  const [isDraggingTime, setIsDraggingTime] = useState(false)
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const volumeBarRef = useRef<HTMLDivElement>(null)

  const globalPreview = platformLinks.find((link) => link.platform === "preview")?.url
  const currentAudioSrc = hasTracks 
    ? (tracks[currentTrackIndex]?.preview_url || globalPreview)
    : globalPreview

  // Handlers
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
          console.error("Playback failed", err)
          setAudioError(true)
          setIsPlaying(false)
        }
      }
    }
  }

  const playSpecificTrack = (index: number) => {
    if (index === currentTrackIndex) {
      togglePlay()
    } else {
      setCurrentTrackIndex(index)
      setIsPlaying(true)
      setProgress(0)
      setAudioError(false)
    }
  }

  const getNaturalVolume = () => isMuted ? 0 : Math.pow(volume, 3)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = getNaturalVolume()
  }, [volume, isMuted, currentAudioSrc])

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.src = currentAudioSrc || ""
      audioRef.current.load()
      audioRef.current.volume = getNaturalVolume()
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }, [currentTrackIndex, currentAudioSrc])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingTime && progressBarRef.current && audioRef.current) {
        const rect = progressBarRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const p = Math.min(Math.max(x / rect.width, 0), 1)
        audioRef.current.currentTime = p * (audioRef.current.duration || 1)
        setProgress(p * 100)
      }
      if (isDraggingVolume && volumeBarRef.current) {
        const rect = volumeBarRef.current.getBoundingClientRect()
        const y = rect.bottom - e.clientY
        const p = Math.min(Math.max(y / rect.height, 0), 1)
        setVolume(p)
        setIsMuted(p === 0)
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
    if (audioRef.current && !isDraggingTime) {
      const current = audioRef.current.currentTime
      const duration = audioRef.current.duration || 1
      setProgress((current / duration) * 100)
    }
  }

  const formatPlatformName = (p: string) => p.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

  if (!mounted) return null

  const visiblePlatforms = platformLinks.filter(l => l.platform !== "preview" && l.platform !== "meta_type")

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl opacity-20 float-animation" />
      <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-red-700/10 rounded-full blur-3xl opacity-20 float-animation" style={{ animationDelay: "3s" }} />

      <div className={`relative z-10 w-full ${showAlbumView ? 'max-w-4xl' : 'max-w-sm'}`}>
        
        <div className={`grid gap-6 ${showAlbumView ? 'grid-cols-1 md:grid-cols-2 items-start' : 'grid-cols-1'}`}>
          
          {/* --- LEFT: Main Card --- */}
          <div className="w-full relative group/main" ref={leftCardRef}>
            <Card className="glass-card shadow-2xl border-white/10 p-6 reveal-animation flex flex-col h-full relative" style={{ animationDelay: "0.2s" }}>
              
              {hasTracks && isAlbumMode && !isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-all z-20"
                  aria-label="Show Tracks"
                >
                  <ListMusic className="w-5 h-5" />
                </button>
              )}

              <div className="mb-6">
                {smartLink.artwork_url ? (
                  <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/10 group mb-6">
                    <Image
                      src={smartLink.artwork_url}
                      alt={smartLink.title}
                      width={192}
                      height={192}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      crossOrigin="anonymous"
                    />

                    {currentAudioSrc && !audioError && (
                      <>
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 active:opacity-100'}`}>
                          
                          <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-white/20 border border-white/30 backdrop-blur-md flex items-center justify-center hover:bg-white/30 hover:scale-105 transition-all duration-200 shadow-xl">
                            {isPlaying ? <Pause className="w-6 h-6 text-white fill-white" /> : <Play className="w-6 h-6 text-white fill-white ml-0.5" />}
                          </button>
                          
                          {/* Volume Slider */}
                          <div className="absolute bottom-3 right-3 flex flex-col items-center gap-2 group/volume z-20" onClick={e => e.stopPropagation()}>
                            <div className="h-0 overflow-hidden group-hover/volume:h-24 transition-all duration-300 flex flex-col justify-end items-center mb-1 opacity-0 group-hover/volume:opacity-100">
                               <div ref={volumeBarRef} className="w-1.5 h-20 bg-black/20 backdrop-blur-md rounded-full relative cursor-pointer" onMouseDown={() => setIsDraggingVolume(true)}>
                                  <div className="absolute inset-0 bg-white/20 rounded-full" />
                                  <div className="absolute bottom-0 left-0 w-full bg-white rounded-full" style={{ height: `${isMuted ? 0 : volume * 100}%` }} />
                               </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-all backdrop-blur-md">
                              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div ref={progressBarRef} className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 cursor-pointer group/timeline hover:h-2 transition-all duration-200" onClick={e => e.stopPropagation()} onMouseDown={() => setIsDraggingTime(true)}>
                          <div className="h-full bg-white/40 w-full absolute top-0 left-0" />
                          <div className="h-full bg-red-500 relative" style={{ width: `${progress}%` }}>
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full scale-0 group-hover/timeline:scale-100 transition-transform shadow-sm" />
                          </div>
                        </div>
                      </>
                    )}
                    {currentAudioSrc && (
                      <audio 
                        ref={audioRef} 
                        src={currentAudioSrc} 
                        crossOrigin="anonymous" 
                        onTimeUpdate={handleTimeUpdate} 
                        onEnded={() => setIsPlaying(false)} 
                        onError={() => setAudioError(true)}
                        onLoadStart={(e) => { e.currentTarget.volume = getNaturalVolume() }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="relative w-48 h-48 mx-auto rounded-2xl bg-gradient-to-br from-red-600/10 to-red-700/10 flex items-center justify-center mb-6 border border-white/5">
                    <Disc className="w-16 h-16 text-white/20 animate-spin-slow" />
                  </div>
                )}

                <div className="text-center space-y-1">
                  <h1 className="text-2xl font-bold text-white tracking-tight leading-tight text-balance">{smartLink.title}</h1>
                  {smartLink.artist && <p className="text-base text-white/50 font-light">{smartLink.artist}</p>}
                </div>
              </div>

              <div className="space-y-2 w-full mt-auto">
                {visiblePlatforms.map((link, i) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="block w-full" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                    <div className={`platform-button h-10 px-4 rounded-lg backdrop-blur-xl border transition-all duration-200 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] ${platformColors[link.platform] || "bg-zinc-800"}`}>
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-10 flex items-center justify-center shrink-0">
                          {platformLogos[link.platform] && (
                            <Image 
                              src={platformLogos[link.platform]} 
                              alt={link.platform} 
                              width={24} 
                              height={24} 
                              className={`${(link.platform === 'last.fm' || link.platform === 'lastfm') ? 'w-9 h-6' : 'w-5 h-5'} object-contain brightness-0 invert`} 
                            />
                          )}
                        </div>
                        <span className="text-sm font-medium text-white">{formatPlatformName(link.platform)}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          </div>

          {/* --- RIGHT: Track List --- */}
          {showAlbumView && (
            <div 
              className="w-full animate-in fade-in slide-in-from-right-4 duration-300"
              style={{ 
                height: rightCardHeight ? `${rightCardHeight}px` : 'auto' 
              }}
            >
              <Card className="glass-card shadow-2xl border-white/10 flex flex-col h-full overflow-hidden bg-black/20 max-h-[500px] md:max-h-[700px]">
                <div className="p-5 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-5 h-5 text-red-500" />
                    <span className="font-semibold text-white">Album Tracks</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded-md">{tracks.length} songs</span>
                     <button onClick={() => setIsSidebarOpen(false)} className="text-white/40 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                <div 
                  className="flex-1 overflow-y-auto p-3 pr-1
                  [&::-webkit-scrollbar]:w-1.5 
                  [&::-webkit-scrollbar-track]:bg-transparent 
                  [&::-webkit-scrollbar-thumb]:bg-white/10 
                  [&::-webkit-scrollbar-thumb]:rounded-full 
                  hover:[&::-webkit-scrollbar-thumb]:bg-white/20 
                  transition-colors"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.1) transparent'
                  }}
                >
                  <div className="space-y-1">
                    {tracks.map((track, i) => {
                      const isCurrent = i === currentTrackIndex
                      const isTrackPlaying = isCurrent && isPlaying
                      return (
                        <button key={track.id || i} onClick={() => playSpecificTrack(i)} className={`w-full group flex items-center gap-3 p-3 rounded-lg transition-all duration-200 text-left relative overflow-hidden ${isCurrent ? "bg-white/10 border border-white/10" : "hover:bg-white/5 border border-transparent"}`}>
                          {isCurrent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-lg" />}
                          <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-xs transition-colors ${isCurrent ? "text-red-400" : "text-white/30 group-hover:text-white"}`}>
                            {isTrackPlaying ? (
                              <div className="flex gap-[2px] h-3 items-end">
                                <span className="w-0.5 bg-current animate-music-bar-1 h-2" />
                                <span className="w-0.5 bg-current animate-music-bar-2 h-3" />
                                <span className="w-0.5 bg-current animate-music-bar-3 h-1.5" />
                              </div>
                            ) : (
                              <span className="group-hover:hidden font-mono">{i + 1}</span>
                            )}
                            <Play className={`w-3 h-3 fill-current ${isTrackPlaying ? "hidden" : "hidden group-hover:block ml-0.5"}`} />
                          </div>
                          <div className="flex-1 min-w-0 z-10">
                            <p className={`text-sm font-medium truncate ${isCurrent ? "text-white" : "text-white/80 group-hover:text-white"}`}>{track.title}</p>
                            {(track.artist && track.artist !== smartLink.artist) && <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>}
                          </div>
                          <div className="text-xs text-white/20 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {track.duration || "--:--"}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          {isLoadingTracks && !hasTracks && (
            <div className="absolute -right-8 top-1/2 -translate-y-1/2 text-white/20">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}

        </div>

        <div className="text-center mt-8 reveal-animation" style={{ animationDelay: "0.6s" }}>
          <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors font-light inline-flex items-center gap-2 group">
            Create your own <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}