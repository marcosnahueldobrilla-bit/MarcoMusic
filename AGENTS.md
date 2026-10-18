<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- UI lives in `src/components/marco` (single-screen app with internal tab state) so the same UI renders in the web route and the Capacitor SPA (`mobile/`, built with `vite.mobile.config.ts`) — the APK has no server.
- Playback engine + persistence in `src/lib/music/store.ts`; file access in `src/lib/music/library.ts`; build system in `src/lib/build` + `.github/workflows/android-apk.yml` — keep these layers separate.
- The build screen is injected as a prop; never import server functions from code reachable by `mobile/main.tsx`.
- APK builds run on GitHub Actions (Lovable can't run Gradle); the server calls GitHub through the linked GitHub connector (gateway, `GITHUB_API_KEY`) and only falls back to PAT secrets, uses `GITHUB_REPO`, and proxies the release asset via `/api/apk/$runNumber` so no credential reaches the browser.
- Code reaches the build repo via the GitHub git-data API (blobs/tree/commit) from a /tmp copy; the sandbox cannot run git push and Lovable Git sync would create a new repo.
- Android project is generated in CI (`cap add android`), with permissions and `native/MainActivity.java` patched in — edit those, not a committed android/ folder.
