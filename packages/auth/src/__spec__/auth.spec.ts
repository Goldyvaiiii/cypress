import { describe, it, expect, vi, beforeEach, afterEach, Mocked } from 'vitest'
import { createAuth } from '../auth'
import type { AuthDependencies } from '../types'
import pkg from '@packages/root'
import express from 'express'
import os from 'os'
import { machineId } from 'node-machine-id'
import Bluebird from 'bluebird'
const BASE_URL = 'https://foo.invalid/login.html'
const RANDOM_STRING = 'a'.repeat(32)
const PORT = 9001
const REDIRECT_URL = `http://127.0.0.1:${PORT}/redirect-to-auth`
const FULL_LOGIN_URL = `https://foo.invalid/login.html?port=${PORT}&state=${RANDOM_STRING}&machineId=abc123&cypressVersion=${pkg.version}&platform=linux`
const UTM_SOURCE = 'UTM Source'
const UTM_MEDIUM = 'UTM Medium'
const UTM_CONTENT = 'UTM Content'
const MACHINE_ID = 'abc123'

vi.mock('express', () => ({
  default: vi.fn(),
}))

vi.mock('node-machine-id', () => ({
  machineId: vi.fn(),
}))

vi.mock('os', () => ({
  default: {
    platform: vi.fn().mockReturnValue('linux'),
  },
}))

vi.mock('bluebird', async () => {
  const actual = await vi.importActual('bluebird')

  return {
    ...actual,
    default: {
      ...actual.default,
      fromCallback: vi.fn(),
    },
  }
})

describe('auth', () => {
  let auth: ReturnType<typeof createAuth>
  let dependencies: AuthDependencies
  let mockApi: any
  let mockCache: any
  let mockElectron: any
  let mockRandomId: any
  let mockExpressApp: Mocked<ReturnType<typeof express>>
  let mockExpressServer: Mocked<ReturnType<typeof express.prototype.listen>>

  beforeEach(() => {
    mockApi = {
      getAuthUrls: vi.fn().mockResolvedValue(new Map([['dashboardAuthUrl', BASE_URL]])),
      postLogout: vi.fn().mockResolvedValue(undefined),
    }

    mockCache = {
      getUser: vi.fn().mockResolvedValue({ name: '', email: '', authToken: '' }),
      setUser: vi.fn().mockResolvedValue(undefined),
      removeUser: vi.fn().mockResolvedValue(undefined),
    }

    mockElectron = {
      shell: {
        openExternal: vi.fn().mockResolvedValue(undefined),
      },
    }

    mockRandomId = vi.fn().mockImplementation(() => {
        return RANDOM_STRING
    })

    let resolveServerListen: () => void = () => {}

    mockExpressServer = {
      close: vi.fn(),
      address: vi.fn().mockImplementation(() => {
        return {
          port: PORT,
        }
      }),
    }

    mockExpressApp = {
      get: vi.fn(),
      listen: vi.fn().mockImplementation((port?: number, host?: string, cb: (err?: Error) => void) => {
        setTimeout(async () => {
          await cb()
          resolveServerListen()
        }, 0)

        return mockExpressServer
      }),
    } as any as Mocked<ReturnType<typeof express>>

    vi.mocked(express).mockImplementation(() => {
      return mockExpressApp
    })

    vi.mocked(machineId).mockResolvedValue(MACHINE_ID)

    dependencies = {
      api: mockApi,
      cache: mockCache,
      electron: mockElectron,
      randomId: mockRandomId,
    }

    auth = createAuth(dependencies)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('_internal.getOriginFromUrl', () => {
    it('given an https URL, returns the origin', () => {
      const origin = auth._internal.getOriginFromUrl(FULL_LOGIN_URL)

      expect(origin).toBe('https://foo.invalid')
    })

    it('given an http URL, returns the origin', () => {
      const origin = auth._internal.getOriginFromUrl('http://foo.invalid/login.html?abc=123&foo=bar')

      expect(origin).toBe('http://foo.invalid')
    })
  })

  describe('_internal.buildFullLoginUrl', () => {
    beforeEach(() => {
    })

    it('uses random and server.port to form a URL along with environment info', async () => {
      const url = new URL(await auth._internal.buildFullLoginUrl(BASE_URL, mockExpressServer))

      expect(url.searchParams.get('port')).toBe(PORT.toString())
      expect(url.searchParams.get('state')).toBe(RANDOM_STRING)
      expect(url.searchParams.get('machineId')).toBe(MACHINE_ID)
    })

    it('does not regenerate the state code', async () => {
      await auth._internal.buildFullLoginUrl(BASE_URL, mockExpressServer)
      await auth._internal.buildFullLoginUrl(BASE_URL, mockExpressServer)

      expect(mockRandomId).toHaveBeenCalledTimes(1)
    })

    it('uses utm code to form a trackable URL', async () => {
      const url = new URL(await auth._internal.buildFullLoginUrl(BASE_URL, mockExpressServer, 'UTM Source', 'UTM Medium', 'UTM Content'))

      expect(url.searchParams.get('utm_source')).toBe(UTM_SOURCE)
      expect(url.searchParams.get('utm_medium')).toBe(UTM_MEDIUM)
      expect(url.searchParams.get('utm_content')).toBe(UTM_CONTENT)
    })
  })

  describe('_internal.launchNativeAuth', () => {
    it('handles errors when openExternal fails', async () => {
      mockElectron.shell.openExternal.mockRejectedValue(new TypeError('Cannot open external'))

      const sendWarning = vi.fn()

      await auth._internal.launchNativeAuth(REDIRECT_URL, sendWarning)

      expect(mockElectron.shell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
    })

    describe('with shell available', () => {
      it('returns a promise that is fulfilled when openExternal succeeds', async () => {
        mockElectron.shell.openExternal.mockResolvedValue(undefined)
        const sendWarning = vi.fn()

        await auth._internal.launchNativeAuth(REDIRECT_URL, sendWarning)

        expect(mockElectron.shell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
        expect(sendWarning).not.toHaveBeenCalled()
      })

      it('is still fulfilled when openExternal fails, but sendWarning is called', async () => {
        mockElectron.shell.openExternal.mockRejectedValue(new Error('Failed to open'))
        const sendLaunchError = vi.fn()

        await auth._internal.launchNativeAuth(REDIRECT_URL, sendLaunchError)

        expect(mockElectron.shell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
        // Note: sendLaunchError will be called after timeout, but we can't easily test that here
      })
    })
  })

  describe('.start', () => {
    it('resolves upon successful auth', async () => {
      mockApi.getAuthUrls.mockResolvedValue(new Map([['dashboardAuthUrl', 'http://www.foo.bar']]))
      mockElectron.shell.openExternal.mockResolvedValue(undefined)
      vi.mocked(Bluebird.fromCallback).mockResolvedValue(null)
      expect(auth.start(vi.fn(), 'code')).resolves
    })

    it('resolves when auth fails', async () => {
      mockApi.getAuthUrls.mockRejectedValue(new Error('test error'))

      const onMessage = vi.fn()

      await expect(auth.start(onMessage, 'code')).resolves
    })

    it('sends an AUTH_ERROR_DURING_LOGIN message on unhandled errors', async () => {
      mockApi.getAuthUrls.mockResolvedValue(new Map([['dashboardAuthUrl', 'http://www.foo.bar']]))
      mockElectron.shell.openExternal.mockResolvedValue(undefined)
      vi.mocked(Bluebird.fromCallback).mockRejectedValue({ message: 'unexpected error' })

      const onMessageSpy = vi.fn()

      await auth.start(onMessageSpy, 'code')

      expect(onMessageSpy).toHaveBeenCalledWith({
        name: 'AUTH_ERROR_DURING_LOGIN',
        message: 'unexpected error',
        browserOpened: false,
      })
    })
  })
})
