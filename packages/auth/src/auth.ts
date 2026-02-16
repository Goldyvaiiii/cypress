import Bluebird from 'bluebird'
import type { CachedUser } from '@packages/types'
import { createUser } from './user'
import type { CacheClient, ApiClient } from './user'

import Debug from 'debug'
import pkg from '@packages/root'
import { machineId } from 'node-machine-id'
import os from 'os'
import _ from 'lodash'
import express from 'express'

const debug = Debug('cypress:auth:auth')

/**
 * Internal state for the auth module
 */
interface AuthState {
  app: any
  server: any
  authState: string | null
  authCallback: ((err: Error | null, user?: CachedUser) => void) | null
  openExternalAttempted: boolean
  authRedirectReached: boolean
}

export interface LogInStateChanged {
  (message: { name: string, message?: string, browserOpened: boolean }): void
}

interface Electron {
  shell: {
    openExternal: (url: string) => Promise<void>
  }
}

export interface AuthDependencies {
  api: ApiClient
  cache: CacheClient
  electron: Electron
  randomId: (length?: number) => string
}

type Auth = {
  start: (onMessage: LogInStateChanged, utmSource: string, utmMedium?: string, utmContent?: string) => Bluebird<void | CachedUser>
  stopServer: () => void
  getUser: () => Bluebird<CachedUser>
  logOut: () => Bluebird<void>
  _internal: {
    buildLoginRedirectUrl: (server: any) => string
    buildFullLoginUrl: (baseLoginUrl: string, server: any, utmSource?: string, utmMedium?: string, utmContent?: string) => Promise<string>
    getOriginFromUrl: (originalUrl: string) => string
    launchServer: (baseLoginUrl: string, sendMessage: (name: string, message?: string) => void, utmSource?: string, utmMedium?: string, utmContent?: string) => Promise<void>
    stopServer: () => void
    launchNativeAuth: (loginUrl: string, sendMessage: (name: string, message?: string) => void) => Promise<void>
  }
}

/**
 * Create the auth module with dependency injection
 */
export function createAuth ({ api, cache, electron, randomId }: AuthDependencies): Auth {
  debug('creating auth for data context')
  // Internal state
  const state: AuthState = {
    app: undefined,
    server: undefined,
    authState: null,
    authCallback: null,
    openExternalAttempted: false,
    authRedirectReached: false,
  }

  // Create user module internally
  const user = createUser({ api, cache })

  const buildLoginRedirectUrl = (server: any): string => {
    const { port } = server.address()

    return `http://127.0.0.1:${port}/redirect-to-auth`
  }

  const buildFullLoginUrl = async (
    baseLoginUrl: string,
    server: any,
    utmSource?: string,
    utmMedium?: string,
    utmContent?: string,
  ): Promise<string> => {
    const { port } = server.address()

    if (!state.authState) {
      state.authState = randomId(32)
    }

    const authUrl = new URL(baseLoginUrl)
    const id = await machineId()

    for (const [key, value] of Object.entries({
      port: port.toString(),
      state: state.authState,
      machineId: id,
      cypressVersion: pkg.version,
      platform: os.platform(),
      ...(!!(utmMedium && utmSource && utmContent) && {
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_content: utmContent,
      }),
    })) {
      authUrl.searchParams.set(key, value)
    }

    return authUrl.toString()
  }

  const getOriginFromUrl = (originalUrl: string): string => {
    return new URL(originalUrl).origin
  }

  /**
   * Launch the auth server to listen for callbacks
   */
  const launchServer = async (
    baseLoginUrl: string,
    sendMessage: (name: string, message?: string) => void,
    utmSource?: string,
    utmMedium?: string,
    utmContent?: string,
  ): Promise<void> => {
    if (!state.server) {
      // launch an express server to listen for the auth callback from Cypress Cloud
      const origin = getOriginFromUrl(baseLoginUrl)

      debug('Launching auth server with origin', origin)
      state.app = express()

      state.app.get('/redirect-to-auth', (req: any, res: any) => {
        state.authRedirectReached = true

        buildFullLoginUrl(baseLoginUrl, state.server, utmSource, utmMedium, utmContent)
          .then((fullLoginUrl) => {
            debug('Received GET to /redirect-to-auth, redirecting: %o', { fullLoginUrl })

            res.redirect(303, fullLoginUrl)

            sendMessage('AUTH_BROWSER_LAUNCHED')
          })
      })

      state.app.get('/auth', (req: any, res: any) => {
        debug('Received GET to /auth with query params %o', req.query)

        const redirectToStatus = (status: string) => {
          res.redirect(`${baseLoginUrl}?status=${status}`)
        }

        /**
         * Cypress Cloud can redirect to us with an error; or, if Electron's shell.openExternal
         * is bugging out, `authCallback` can be undefined and reaching this point makes no sense.
         * @see https://github.com/cypress-io/cypress/pull/5243
         */
        if (_.get(req.query, 'status') === 'error' || !state.authCallback) {
          if (state.authCallback) {
            state.authCallback(new Error('There was an error authenticating to Cypress Cloud.'))
          }

          return redirectToStatus('error')
        }

        const { state: queryState, name, email, access_token } = req.query

        if (queryState === state.authState && access_token) {
          const userObj: CachedUser = {
            name,
            email,
            authToken: access_token,
          }

          return user
            .set(userObj)
            .then(() => {
              if (state.authCallback) {
                state.authCallback(null, userObj)
              }

              redirectToStatus('success')
            })
            .catch((err: Error) => {
              if (state.authCallback) {
                state.authCallback(err)
              }

              redirectToStatus('error')
            })
        }

        redirectToStatus('error')
      })

      return new Promise<void>((resolve, reject) => {
        state.server = state.app.listen(0, '127.0.0.1', (err?: Error) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }

  const stopServer = (): void => {
    debug('Closing auth server')
    if (state.server) {
      state.server.close()
      state.server = undefined
    }

    state.app = undefined
    state.authState = null
    state.authCallback = null
    state.openExternalAttempted = false
    state.authRedirectReached = false
  }

  const launchNativeAuth = async (
    loginUrl: string,
    sendMessage: (name: string, message?: string) => void,
  ): Promise<void> => {
    const warnCouldNotLaunch = () => {
      if (state.openExternalAttempted && !state.authRedirectReached) {
        sendMessage('AUTH_COULD_NOT_LAUNCH_BROWSER', loginUrl)
      }
    }

    warnCouldNotLaunch()

    setTimeout(warnCouldNotLaunch, 4000)

    state.openExternalAttempted = true

    try {
      await electron.shell.openExternal(loginUrl)
    } catch (err) {
      debug('Error launching native auth: %o', { err })
      warnCouldNotLaunch()
    }
  }

  /**
   * Grouping internal APIs under separate export to allow for stubbing
   * in public API tests.
   */
  const _internal = {
    buildLoginRedirectUrl,
    buildFullLoginUrl,
    getOriginFromUrl,
    launchServer,
    stopServer,
    launchNativeAuth,
  }

  /**
   * Start the authentication flow
   * @returns a promise that is resolved with a user when auth is complete or rejected when it fails
   */
  const start = (
    onMessage: (message: { name: string, message?: string, browserOpened: boolean }) => void,
    utmSource: string | undefined,
    utmMedium: string | undefined,
    utmContent: string | undefined,
  ): Bluebird<void | CachedUser> => {
    function sendMessage (name: string, message?: string) {
      onMessage({
        name,
        message,
        browserOpened: state.authRedirectReached,
      })
    }
    state.authRedirectReached = false

    return user
      .getBaseLoginUrl()
      .then((baseLoginUrl) => {
        return launchServer(baseLoginUrl, sendMessage, utmSource, utmMedium, utmContent)
      })
      .then(() => {
        return buildLoginRedirectUrl(state.server!)
      })
      .then((loginRedirectUrl) => {
        debug('Trying to open native auth to URL %s', loginRedirectUrl)

        return launchNativeAuth(loginRedirectUrl, sendMessage).then(() => {
          debug('successfully opened native auth url')
        })
      })
      .then(() => {
        return Bluebird.fromCallback<CachedUser>((cb) => {
          state.authCallback = cb
        })
      })
      .catch((err: Error) => {
        sendMessage('AUTH_ERROR_DURING_LOGIN', err.message)
      })
      .finally(() => {
        stopServer()
      })
  }

  return {
    start,
    stopServer,
    getUser: () => user.get(),
    logOut: () => user.logOut(),
    _internal,
  }
}
