import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Why both: the single-session embed page is served through the same reverse-proxy pairing URLs
// as the full web client, so an absolute `/assets/` reference breaks it just the same.
const WEB_ENTRY_PAGES = ['web-index.html', 'single-session-index.html']

for (const page of WEB_ENTRY_PAGES) {
  const indexPath = resolve('out/web', page)
  const html = await readFile(indexPath, 'utf8').catch(() => null)
  if (html === null) {
    console.error(`Web build is missing ${indexPath}`)
    process.exit(1)
  }

  const absoluteAssetReference = /\b(?:src|href)=["']\/assets\//.exec(html)

  if (absoluteAssetReference) {
    console.error(
      `Web build must use relative asset URLs for reverse-proxy pairing URLs; found ${absoluteAssetReference[0]} in ${indexPath}`
    )
    process.exit(1)
  }
}
