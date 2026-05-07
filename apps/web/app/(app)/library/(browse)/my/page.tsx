import { redirect } from "next/navigation";

// /library/my used to combine bookmarks and playlists. The floor
// revamp split them into /library/my/videos and /library/my/playlists.
// Saved videos is the more direct interpretation of "my library", so
// the legacy URL lands there.

export default function MyLibraryRedirect() {
  redirect("/library/my/videos");
}
