import fs from 'fs/promises'
import path from 'path'

const SITE_URL = 'https://reference.sanity.io'
const INPUT_DIR = 'input-docs'
const DOCS_DIR = 'docs'
const LLMS_FILE = 'docs/llms.txt'
const LLMS_FULL_FILE = 'docs/llms-full.txt'
const SITEMAP_FILE = 'docs/sitemap.xml'
const ROBOTS_FILE = 'docs/robots.txt'

type CommentPart = {kind: string; text: string}

function joinParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ''
  return (parts as CommentPart[]).map((p) => (typeof p?.text === 'string' ? p.text : '')).join('')
}

function truncate(text: string, max = 240): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

function extractFirstProseParagraph(text: string): string | null {
  if (!text) return null
  let cleaned = text.replace(/<!--[\s\S]*?-->/g, '')
  while (true) {
    const m = cleaned.match(/^\s*<(p|div)\b[^>]*>[\s\S]*?<\/\1>\s*/i)
    if (!m) break
    cleaned = cleaned.slice(m[0].length)
  }
  for (const raw of cleaned.split(/\n\s*\n/)) {
    let para = raw.trim()
    if (!para) continue
    if (para.startsWith('#')) continue
    if (/^>\s*\[!/.test(para)) continue
    if (para.startsWith('```') || para.startsWith('~~~')) continue
    if (/^ {4}/.test(para)) continue
    if (para.startsWith('<')) continue
    const lines = para.split('\n')
    const isBadgeOnly = lines.every((l) => {
      const t = l.trim()
      return !t || /^\[?!\[/.test(t)
    })
    if (isBadgeOnly) continue
    if (para.startsWith('>')) {
      para = para
        .split('\n')
        .map((l) => l.replace(/^\s*>\s?/, ''))
        .join('\n')
        .trim()
      para = para.split(/\n\s*\n/)[0].trim()
    }
    return para.replace(/\s+/g, ' ').trim()
  }
  return null
}

function packageSlug(npmName: string): string {
  return npmName.replace(/^@/, '_')
}

async function readDescription(jsonPath: string): Promise<string | null> {
  let raw: string
  try {
    raw = await fs.readFile(jsonPath, 'utf-8')
  } catch {
    return null
  }
  let data: {comment?: {summary?: unknown}; readme?: unknown}
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const summary = extractFirstProseParagraph(joinParts(data.comment?.summary))
  if (summary) return truncate(summary)
  const readme = extractFirstProseParagraph(joinParts(data.readme))
  if (readme) return truncate(readme)
  return null
}

async function readPackageName(jsonPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(jsonPath, 'utf-8')
    const data = JSON.parse(raw) as {name?: string}
    return typeof data.name === 'string' ? data.name : null
  } catch {
    return null
  }
}

const dirents = await fs.readdir(INPUT_DIR, {withFileTypes: true})
const dirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name)

const packages: {name: string; description: string | null}[] = []
for (const dir of dirs) {
  const jsonPath = path.join(INPUT_DIR, dir, 'typedoc.json')
  const name = await readPackageName(jsonPath)
  if (!name) {
    console.warn(`Skipping ${dir}: missing or unreadable typedoc.json`)
    continue
  }
  const description = await readDescription(jsonPath)
  packages.push({name, description})
}

packages.sort((a, b) => a.name.localeCompare(b.name))

const lines: string[] = []
lines.push('# Sanity API Reference')
lines.push('')
lines.push(
  '> Unified TypeDoc-generated API reference for Sanity JavaScript libraries — clients, SDKs, visual editing, and adjacent packages.',
)
lines.push('')
lines.push('## Packages')
lines.push('')
for (const pkg of packages) {
  const url = `${SITE_URL}/${packageSlug(pkg.name)}/`
  lines.push(
    pkg.description ? `- [${pkg.name}](${url}): ${pkg.description}` : `- [${pkg.name}](${url})`,
  )
}
lines.push('')
lines.push('## Per-package full reference')
lines.push('')
lines.push(
  '> Same content as `llms-full.txt` below, but split per package so each file fits in a smaller context window. Pull only the package(s) you need.',
)
lines.push('')
for (const pkg of packages) {
  const fullUrl = `${SITE_URL}/${packageSlug(pkg.name)}/llms-full.txt`
  lines.push(`- [${pkg.name}](${fullUrl})`)
}
lines.push('')
lines.push('## Optional')
lines.push('')
lines.push(
  `- [Full reference](${SITE_URL}/llms-full.txt): every public symbol across all packages, concatenated. ~1.2M tokens — only useful for agents with a 1M+ context window. For everything else, use the per-package files above.`,
)
lines.push('')

await fs.writeFile(LLMS_FILE, lines.join('\n'), 'utf-8')
console.log(`Wrote ${LLMS_FILE} with ${packages.length} packages`)

async function collectIndexHtmlPaths(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, {withFileTypes: true, recursive: true})
  return entries
    .filter((e) => e.isFile() && e.name === 'index.html')
    .map((e) => path.join(e.parentPath ?? dir, e.name))
}

function htmlPathToUrl(filePath: string): string {
  const rel = path.relative(DOCS_DIR, filePath)
  const dir = path.dirname(rel).split(path.sep).join('/')
  const slug = dir === '.' ? '' : `${dir}/`
  return `${SITE_URL}/${slug}`
}

const indexFiles = await collectIndexHtmlPaths(DOCS_DIR)
const urls = indexFiles.map(htmlPathToUrl).sort()

const sitemapLines: string[] = []
sitemapLines.push('<?xml version="1.0" encoding="UTF-8"?>')
sitemapLines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
for (const url of urls) {
  sitemapLines.push(`  <url><loc>${url}</loc></url>`)
}
sitemapLines.push('</urlset>')
sitemapLines.push('')
await fs.writeFile(SITEMAP_FILE, sitemapLines.join('\n'), 'utf-8')
console.log(`Wrote ${SITEMAP_FILE} with ${urls.length} URLs`)

const robots = ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n')
await fs.writeFile(ROBOTS_FILE, robots, 'utf-8')
console.log(`Wrote ${ROBOTS_FILE}`)

async function collectIndexMdPaths(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, {withFileTypes: true, recursive: true})
  return entries
    .filter((e) => e.isFile() && e.name === 'index.md')
    .map((e) => path.join(e.parentPath ?? dir, e.name))
}

function mdPathToUrl(filePath: string): string {
  const rel = path.relative(DOCS_DIR, filePath)
  const dir = path.dirname(rel).split(path.sep).join('/')
  const slug = dir === '.' ? '' : `${dir}/`
  return `${SITE_URL}/${slug}`
}

const mdFiles = (await collectIndexMdPaths(DOCS_DIR)).sort()

async function buildSections(files: string[]): Promise<string[]> {
  const out: string[] = []
  for (const file of files) {
    const url = mdPathToUrl(file)
    const body = (await fs.readFile(file, 'utf-8')).trim()
    if (!body) continue
    out.push('---', '', `Source: ${url}`, '', body, '')
  }
  return out
}

const fullLines: string[] = [
  '# Sanity API Reference (full)',
  '',
  `> Concatenation of every page on ${SITE_URL}/, in markdown form. For the package index, see ${SITE_URL}/llms.txt.`,
  '',
  ...(await buildSections(mdFiles)),
]
await fs.writeFile(LLMS_FULL_FILE, fullLines.join('\n'), 'utf-8')
console.log(`Wrote ${LLMS_FULL_FILE} with ${mdFiles.length} pages`)

const filesByPackage = new Map<string, string[]>()
for (const file of mdFiles) {
  const rel = path.relative(DOCS_DIR, file).split(path.sep).join('/')
  for (const pkg of packages) {
    const slug = packageSlug(pkg.name)
    if (rel === `${slug}/index.md` || rel.startsWith(`${slug}/`)) {
      if (!filesByPackage.has(slug)) filesByPackage.set(slug, [])
      filesByPackage.get(slug)!.push(file)
      break
    }
  }
}

for (const pkg of packages) {
  const slug = packageSlug(pkg.name)
  const pkgFiles = filesByPackage.get(slug) ?? []
  if (pkgFiles.length === 0) continue
  const pkgLines: string[] = [`# ${pkg.name}`, '']
  if (pkg.description) pkgLines.push(`> ${pkg.description}`, '')
  pkgLines.push(...(await buildSections(pkgFiles)))
  const outPath = path.join(DOCS_DIR, slug, 'llms-full.txt')
  await fs.writeFile(outPath, pkgLines.join('\n'), 'utf-8')
  console.log(`Wrote ${outPath} with ${pkgFiles.length} pages`)
}
