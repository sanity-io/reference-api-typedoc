# Sanity TypeDoc Reference Documentation

## Overview

This repository hosts the unified TypeDoc reference documentation for Sanity JavaScript libraries. It provides a consistent, searchable interface for developers to access API documentation across all Sanity packages.

## Features

- **Unified Documentation**: Single source of truth for all Sanity JavaScript API references
- **TypeScript-Powered**: Leverages TypeDoc to generate accurate, type-based documentation
- **Versioned Documentation**: Access documentation for specific package versions
- **Cross-Referenced**: Navigate between related libraries and functions
- **Searchable**: Full-text search across all API documentation

## How Documentation is Generated

This reference site automatically receives documentation updates through a GitHub Action workflow when new package versions are released. The process works as follows:

1. TypeDoc generates JSON output from library source code
2. A GitHub Action uploads this structured data to Sanity's content platform
3. This reference site renders the documentation in a user-friendly format

## For Library Maintainers

To add your library to this reference documentation site:

1. Add TypeDoc to your project:

```bash
npm install --save-dev typedoc
```
2. Add a documentation build script to your package.json:

```json
"scripts": { "docs": "typedoc --json docs/typedoc.json"  }
```

> [!WARNING]
> You might have to add `--tsconfig /path/to/tsconfig.json` for monorepo projects.

3. Add the upload GitHub Action to your workflow:

```yaml
name: Upload Docs

on:
  # Build on pushes to the main branch
  push:
    branches:
      - main
  # Or when a new release is published
  release:
    types: [published]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm' # or 'pnpm' or 'yarn'

      - name: Install dependencies
        run: npm ci # or pnpm install or yarn install

      - name: Build Docs
        run: npm run docs

      - name: Upload Docs
        uses: sanity-io/reference-api-typedoc/.github/actions/typedoc-upload@latest
        with:
          packageName: "Your npm package name" # for example: @sanity/client
          version: "${{ github.event.release.tag_name || '0.0.0' }}" # make sure it's the "next" and not current version being published
          typedocJsonPath: "docs/typedoc.json"
        env:
          SANITY_DOCS_API_TOKEN: ${{ secrets.SANITY_DOCS_API_TOKEN }} # this will be available org wide
```

4. Ensure your code is properly documented using TS/JSDoc comments

## Documentation Best Practices

For optimal API reference documentation, include the following for all public API surfaces:

- Status indicators (`@public`, `@beta`, `@internal`)
- Clear titles and descriptions
- Parameter documentation (name, type, purpose)
- Return value documentation
- Practical examples
- When possible, include `@throws`, `@remarks`, and `@see/@link` references

## Contributing

Contributions to improve this reference documentation system are welcome. Please see our [contributing guidelines](CONTRIBUTING.md) for more information.

## License

This project is licensed under the [MIT License](LICENSE).
