import dotenv from 'dotenv'
import fs from 'fs/promises'
dotenv.config()

import {createClient} from '@sanity/client'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: '2025-05-29',
  useCdn: false,
  perspective: 'published',
})

const query = `//groq
  *[_type == "typesReference"]{
    "latestVersion": latestVersion->semver,
    "typeDocJson": coalesce(
      latestVersion->typedocJson.code,
      // If the latest version is not found, get the latest apiVersion for the library to prevent accidental removal of the library
      *[_type == "apiVersion" && platform._ref == ^.library->_id && typedocJson != null]|order(semver desc)[0].typedocJson.code
    ),
    "npmName": library->npmName
  }
`

const data = await client.fetch(query)

// Remove the input-docs folder if it exists at the root
await fs.rm('input-docs', {recursive: true, force: true})

// Create the input-docs folder
await fs.mkdir('input-docs')

for (const item of data) {
  if (!item.typeDocJson) {
    continue
  }

  const dirname = item.npmName.replace(/\//g, '-')

  // Make a directory
  await fs.mkdir(`input-docs/${dirname}`)

  // Create a json file with the typeDocJson
  await fs.writeFile(`input-docs/${dirname}/typedoc.json`, item.typeDocJson, 'utf-8')
}
