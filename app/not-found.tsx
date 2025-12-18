import Link from "next/link"
import { Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card shadow-2xl shadow-red-500/10 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
          <Music className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold gradient-text mb-3">Link Not Found</h1>
        <p className="text-muted-foreground mb-6">This smart link doesn't exist or has been removed.</p>
        <Link href="/">
          <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium shadow-lg shadow-red-500/20">
            Create Your Own Link
          </Button>
        </Link>
      </Card>
    </div>
  )
}
