import * as os from 'os'
import { exec } from 'child_process'

import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as http from '@actions/http-client'

const SUPPORTED_PLATFORMS = ['darwin', 'linux']

const getLatestVersion = async (): Promise<string> => {
  const url = 'https://api.github.com/repos/evanw/esbuild/releases/latest'
  const client = new http.HttpClient('setup-esbuild')

  const request = await client.get(url)

  if (request.message.statusCode !== 200) {
    throw new Error(
      `Failed to fetch latest version: ${request.message.statusMessage}`
    )
  }

  const response = await request.readBody()
  const { tag_name } = JSON.parse(response) as { tag_name: string }

  return tag_name.substring(1)
}

async function setup(): Promise<void> {
  const version: string = core.getInput('version') || (await getLatestVersion())

  const platform: string = os.platform()
  const arch: string = os.arch()

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  let cachedPath = tc.find('esbuild', version)
  if (cachedPath) {
    core.info(`Using cached esbuild ${version}`)
    core.addPath(cachedPath)
    return
  }

  core.info(`Setting up esbuild ${version} for ${platform}-${arch}`)

  exec(
    `curl -fsSL https://esbuild.github.io/dl/v0.24.0 | sh\nchmod +x esbuild`,
    error => {
      if (error) {
        throw new Error(`Failed to install esbuild: ${error.message}`)
      }

      const promise = (async (): Promise<void> => {
        core.info(`Caching esbuild ${version}`)
        cachedPath = await tc.cacheFile(
          'esbuild',
          'esbuild',
          'esbuild',
          version,
          arch
        )
        core.addPath(cachedPath)

        core.info('Successfully set up esbuild 🎉')
      })()

      promise.catch((error: Error) => {
        throw new Error(`Failed to cache esbuild: ${error.message}`)
      })
    }
  )
}

export async function run(): Promise<void> {
  try {
    await setup()
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}
