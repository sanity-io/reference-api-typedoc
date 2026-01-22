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
    "attachmentUrl": coalesce(
      latestVersion->attachment.asset->url,
      // If the latest version is not found, get the latest apiVersion for the library to prevent accidental removal of the library
      *[_type == "apiVersion" && platform._ref == ^.library->_id && (attachment != null || typedocJson != null)]|order(semver desc)[0].attachment.asset->url
    ),
    "typeDocJson": coalesce(
      latestVersion->typedocJson.code,
      // If the latest version is not found, get the latest apiVersion for the library to prevent accidental removal of the library
      *[_type == "apiVersion" && platform._ref == ^.library->_id && typedocJson != null]|order(semver desc)[0].typedocJson.code
    ),
    "npmName": library->npmName
  }
`

async function downloadAttachment(attachmentUrl: string): Promise<string> {
  const response = await fetch(attachmentUrl)
  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.statusText}`)
  }

  return await response.text()
}

const data = await client.fetch(query)

// Remove the input-docs folder if it exists at the root
await fs.rm('input-docs', {recursive: true, force: true})

// Create the input-docs folder
await fs.mkdir('input-docs')

for (const item of data) {
  let typeDocJsonContent: string | null = null

  // Priority 1: Try to download attachment if available
  if (item.attachmentUrl) {
    try {
      console.log(`Downloading attachment for ${item.npmName}...`)
      typeDocJsonContent = await downloadAttachment(item.attachmentUrl)
    } catch (error) {
      console.warn(`Failed to download attachment for ${item.npmName}: ${error.message}`)
      console.log(`Falling back to code string for ${item.npmName}...`)
    }
  }

  // Priority 2: Fall back to typeDocJson code string if attachment failed or unavailable
  if (!typeDocJsonContent && item.typeDocJson) {
    console.log(`Using code string for ${item.npmName}...`)
    typeDocJsonContent = item.typeDocJson
  }

  // Skip if no content available from either method
  if (!typeDocJsonContent) {
    console.warn(`No TypeDoc JSON content available for ${item.npmName}, skipping...`)
    continue
  }

  const dirname = item.npmName.replace(/\//g, '-')

  // Make a directory
  await fs.mkdir(`input-docs/${dirname}`)

  // Create a json file with the typeDocJson content
  await fs.writeFile(`input-docs/${dirname}/typedoc.json`, typeDocJsonContent, 'utf-8')
  console.log(`Generated typedoc.json for ${item.npmName}`)
}
