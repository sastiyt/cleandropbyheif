# CleanDrop

A minimal, ad-free Next.js starter for a media-link downloader.

## Run locally
1. Install Node.js 18.17+.
2. In this folder run `npm install`
3. Run `npm run dev`
4. Open `http://localhost:3000`

## Current behavior
- Responsive landing page with paste, link validation, loading state, and clear error feedback.
- API endpoint validates Instagram/YouTube URLs and identifies the platform.
- Does **not** currently fetch or download media. It returns a clear response rather than pretending a download exists.

## Enable authorized downloads
Connect a legitimate provider/API that explicitly permits the intended use. Implement provider resolution inside `app/api/resolve/route.ts`, validate provider responses, enforce rate limits and file-size limits, and only return media the requester is authorized to save. Do not accept arbitrary remote URLs as proxy targets. Never expose provider secrets in browser code.

## Deploy
Deploy to a Node.js-compatible host such as Vercel. Configure any provider credentials as server-side environment variables. Review platform terms and local copyright law before enabling downloads.


## Quality selection UI
The UI supports provider-returned format options and a quality selector. It deliberately displays no fabricated resolutions. The current API returns an empty formats array until a compatible authorized media provider is integrated. The provider should return actual format IDs, labels, details, and secure download URLs.


## Windows desktop app
See [README-DESKTOP.md](README-DESKTOP.md) for building the Windows installer and running CleanDrop in its own desktop window.
