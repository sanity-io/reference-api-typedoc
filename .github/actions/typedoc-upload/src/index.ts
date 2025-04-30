import * as core from '@actions/core'
import fs from 'fs/promises'
import groq from 'groq'
import {createClient} from '@sanity/client'
import {randomUUID} from 'node:crypto'

const client = createClient({
  projectId: '3do82whm',
  dataset: 'staging',
  apiVersion: '2025-04-30',
  useCdn: false,
  token: process.env.SANITY_DOCS_API_TOKEN,
})

async function run() {
  const packageName = core.getInput('packageName')
  const version = core.getInput('version')
  const typedocJsonPath = core.getInput('typedocJsonPath')

  core.info(`[Uploading] Typedoc JSON for ${packageName} v${version}`)

  const typedocJson = await fs.readFile(typedocJsonPath, 'utf-8')

  const query = groq`*[_type == "apiPlatform" && title match $title][0]`

  const platform = await client.fetch(query, {title: packageName})

  if (!platform) {
    core.setFailed(`Platform ${packageName} not found. Check the platform name in Admin Studio`)
    return
  }

  const document = {
    _id: `drafts.${randomUUID()}`,
    _type: 'apiVersion',
    date: new Date().toISOString().split('T')[0],
    platform: {
      _type: 'reference',
      _ref: platform._id,
    },
    semver: version,
    typedocJson: {
      _type: 'code',
      // fs readFile will already read it as a string
      code: typedocJson,
    },
  }

  const res = await client.createIfNotExists(document)

  core.info(`[Uploaded] Typedoc JSON for ${packageName} v${version}`)

  console.log(JSON.stringify(res, null, 2))
}

run()
