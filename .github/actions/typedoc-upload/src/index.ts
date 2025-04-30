import * as core from '@actions/core'
import fs from 'fs/promises'

async function run() {
  const packageName = core.getInput('packageName')
  const version = core.getInput('version')
  const typedocJsonPath = core.getInput('typedocJsonPath')

  core.info(`[Uploading] Typedoc JSON for ${packageName} v${version}`)

  const typedocJson = await fs.readFile(typedocJsonPath, 'utf-8')

  const document = {
    date: new Date().toISOString().split('T')[0],
    // TODO: Get Platform
    // platform: ""
    semver: version,
    typedocJson: {
      _type: 'code',
      code: JSON.parse(typedocJson),
    },
  }

  console.log(JSON.stringify(document, null, 2))
}

run()
