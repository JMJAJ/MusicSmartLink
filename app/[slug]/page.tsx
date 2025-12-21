import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Metadata, Viewport } from "next"
import SmartLinkViewer from "@/components/smart-link-viewer"

interface PageProps {
  params: Promise<{ slug: string }>
}

// This sets the color of the sidebar in Discord embeds
export const viewport: Viewport = {
  // #ef4444 is Tailwind's red-500
  themeColor: "#dc2626", // red-600 theme
  width: 'device-width',
  initialScale: 1,
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: smartLink } = await supabase
    .from("smart_links")
    .select("*")
    .eq("slug", slug)
    .single()

  if (!smartLink) {
    return {
      title: "Link Not Found",
    }
  }

  const title = smartLink.title
  const artist = smartLink.artist || "Unknown Artist"
  const description = `Listen to ${title} by ${artist} on your favorite music platform.`
  const artwork = smartLink.artwork_url || "https://yourdomain.com/default-og.png" // Fallback image

  return {
    title: `${title} by ${artist}`,
    description,
    // Standard OpenGraph
    openGraph: {
      title: `${title} — ${artist}`,
      description,
      url: `https://yourdomain.com/${slug}`,
      siteName: "SmartLink",
      images: [
        {
          url: artwork,
          width: 1200,
          height: 1200,
          alt: `${title} Artwork`,
        },
      ],
      type: "music.song",
    },
    // Twitter / Discord Large Card
    twitter: {
      card: "summary_large_image",
      title: `${title} by ${artist}`,
      description,
      images: [artwork],
    },
    // Useful for search engines
    other: {
      "music:musician": artist,
      "music:song": title,
    },
  }
}

export default async function SmartLinkPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch smart link data
  const { data: smartLink, error: linkError } = await supabase
    .from("smart_links")
    .select("*")
    .eq("slug", slug)
    .single()

  if (linkError || !smartLink) {
    notFound()
  }

  // Fetch platform links
  const { data: platformLinks, error: platformError } = await supabase
    .from("platform_links")
    .select("*")
    .eq("smart_link_id", smartLink.id)

  if (platformError) {
    notFound()
  }

  return <SmartLinkViewer smartLink={smartLink} platformLinks={platformLinks || []} />
}