# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `npm run build:docs` - Fetch TypeDoc JSON from Sanity, generate documentation site, copy 404.html
- `npm run build:action` - Build the GitHub Action for TypeDoc upload
- `npm run format` - Format code using Prettier with Sanity config
- `npx typedoc` — Build locally without connecting to Sanity (without 404 page)
- `npx http-server docs/` - Serve built documentation locally for testing

### Environment Setup
- Requires `.env` file with `SANITY_PROJECT_ID` and `SANITY_DATASET`
- Uses pnpm as package manager (see `pnpm-workspace.yaml`)

## Architecture

This is a TypeDoc documentation aggregation system that serves unified API reference docs for Sanity JavaScript libraries.

### Core Components

**Build System** (`src/build.ts`):
- Fetches TypeDoc JSON data from Sanity CMS using GROQ queries
- Downloads documentation from either file attachments or code strings
- Generates `input-docs/` directory with per-package TypeDoc JSON files
- TypeDoc merges these into a unified documentation site

**GitHub Action** (`.github/actions/typedoc-upload/`):
- Standalone action for library maintainers to upload TypeDoc JSON
- Uploads files as Sanity assets, creates `apiVersion` documents
- Requires matching `apiPlatform` document in Admin Studio
- Uses hardcoded project (`3do82whm`) and dataset (`next`)

**Content Model**:
- `typesReference` - Links to latest version of each library
- `apiPlatform` - Library metadata (npm name, etc.)
- `apiVersion` - Specific version with TypeDoc attachment or JSON code

### Data Flow

1. Libraries run TypeDoc with `--json` flag in CI
2. Upload action creates Sanity documents with TypeDoc data
3. Build script fetches all library docs from Sanity
4. TypeDoc generates unified site from merged JSON files
5. Site deployed with custom styling and analytics

### Configuration

**TypeDoc** (`typedoc.json`):
- Merges all `input-docs/**/*.json` files
- Custom CSS styling (`theme/style.css`)
- Router uses directory structure
- Includes analytics (Fathom, GTM)

The system enables centralized API documentation while maintaining distributed library development.

## 404 Error Handling

The site includes custom 404 error handling:

- **404 Template**: `404-template.html` contains the custom 404 page design
- **Build Integration**: The `build:docs` script automatically copies the template to `docs/404.html`
- **Static Hosting**: Works with GitHub Pages, Netlify, Vercel, and other static hosts
- **Styling**: Uses absolute paths (`/assets/`) to ensure CSS/JS work from any URL depth
- **Navigation**: Includes links back to main documentation sections

The 404 page matches the site's TypeDoc theme and includes helpful navigation options for users who encounter broken or missing links.

## Local testing with unpublished items

- To test with unpublished libraries, copy their output file (JSON) to the `input-docs` directory.
- Run `npx typedoc` to build the site with any libraries in `input-docs`.
- Run `npx http-server docs/` to run the local build.