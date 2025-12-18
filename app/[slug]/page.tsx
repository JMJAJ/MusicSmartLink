import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import SmartLinkViewer from "@/components/smart-link-viewer"

interface PageProps {
  params: Promise<{ slug: string }>
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
