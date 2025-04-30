import * as core from '@actions/core'
import fs from 'fs/promises'

async function run() {
  const packageName = core.getInput('packageName')
  const version = core.getInput('version')
  const typedocJsonPath = core.getInput('typedocJsonPath')

  console.log(`Uploading Typedoc JSON for ${packageName} v${version}`)
  console.log(typedocJsonPath)

  const typedocJson = await fs.readFile(typedocJsonPath, 'utf-8')
  console.log(typedocJson)
}

run()
