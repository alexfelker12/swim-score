import { Link } from "@tanstack/react-router"
import { SearchX } from "lucide-react"
import {
  LinkGone,
  LinkGoneContent,
  LinkGoneDescription,
  LinkGoneFooter,
  LinkGoneTitle,
} from "@/components/link-gone"
import { Button } from "@/components/ui/button"

/**
 * "Seite nicht gefunden": for an address the app doesn't know, and for a
 * page whose Group, Game or Player doesn't exist or isn't visible to the
 * Viewer. A page that finds out only once its data is there (#58) shows it
 * itself; the router doesn't catch `notFound()` thrown while rendering.
 */
export function PageNotFound() {
  return (
    <LinkGone>
      <LinkGoneContent>
        <LinkGoneTitle icon={SearchX}>Seite nicht gefunden</LinkGoneTitle>
        <LinkGoneDescription>Diese Seite gibt es nicht.</LinkGoneDescription>
      </LinkGoneContent>
      <LinkGoneFooter>
        <Button size="xl" nativeButton={false} render={<Link to="/" />}>
          Zur Startseite
        </Button>
      </LinkGoneFooter>
    </LinkGone>
  )
}
