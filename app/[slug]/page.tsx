import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Metadata } from "next"
import SmartLinkViewer from "@/components/smart-link-viewer"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data: smartLink } = await supabase.from("smart_links").select("*").eq("slug", slug).single()

  if (!smartLink) {
    return {
      title: "Link Not Found - Music Smart Link",
    }
  }

  return {
    title: `${smartLink.title} by ${smartLink.artist || "Unknown Artist"}`,
    description: `Listen to ${smartLink.title} on your favorite music platform.`,
    openGraph: {
      title: `${smartLink.title} by ${smartLink.artist || "Unknown Artist"}`,
      description: `Listen to ${smartLink.title} on your favorite music platform.`,
      images: smartLink.artwork_url ? [smartLink.artwork_url] : [],
      type: "music.song",
    },
    twitter: {
      card: "summary_large_image",
      title: `${smartLink.title} by ${smartLink.artist || "Unknown Artist"}`,
      description: `Listen to ${smartLink.title} on your favorite music platform.`,
      images: smartLink.artwork_url ? [smartLink.artwork_url] : [],
    },
  }
}

export default async function SmartLinkPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch smart link data
  const { data: smartLink, error: linkError } = await supabase.from("smart_links").select("*").eq("slug", slug).single()

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
