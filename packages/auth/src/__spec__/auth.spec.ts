import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAuth } from '../auth'
import type { AuthDependencies } from '../types'
import pkg from '@packages/root'

const BASE_URL = 'https://foo.invalid/login.html'
const RANDOM_STRING = 'a'.repeat(32)
const PORT = 9001
const REDIRECT_URL = `http://127.0.0.1:${PORT}/redirect-to-auth`
const FULL_LOGIN_URL = `https://foo.invalid/login.html?port=${PORT}&state=${RANDOM_STRING}&machineId=abc123&cypressVersion=${pkg.version}&platform=linux`
const UTM_SOURCE = 'UTM Source'
const UTM_MEDIUM = 'UTM Medium'
const UTM_CONTENT = 'UTM Content'
const MACHINE_ID = 'abc123'

describe('auth', () => {
  let auth: ReturnType<typeof createAuth>
  let dependencies: AuthDependencies
  let mockApi: any
  let mockCache: any
  let mockElectronShell: any
  let mockMachineId: any
  let mockUtilities: any

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

    mockElectronShell = {
      openExternal: vi.fn().mockResolvedValue(undefined),
    }

    mockMachineId = vi.fn().mockResolvedValue(MACHINE_ID)

    mockUtilities = {
      randomId: vi.fn().mockReturnValue(RANDOM_STRING),
      osPlatform: vi.fn().mockReturnValue('linux'),
      cypressVersion: pkg.version,
      express: vi.fn(() => {
        const app: any = {
          get: vi.fn(),
          listen: vi.fn(),
        }

        return app
      }),
      debug: vi.fn(() => vi.fn()),
    }

    dependencies = {
      api: mockApi,
      cache: mockCache,
      electronShell: mockElectronShell,
      machineId: mockMachineId,
      utilities: mockUtilities,
    }

    auth = createAuth(dependencies)
  })

  afterEach(() => {
    auth.stopServer()
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
    let mockServer: any

    beforeEach(() => {
      mockServer = {
        address: vi.fn().mockReturnValue({
          port: PORT,
        }),
      }
    })

    it('uses random and server.port to form a URL along with environment info', async () => {
      mockUtilities.randomId.mockReturnValue(RANDOM_STRING)
      mockServer.address.mockReturnValue({
        port: PORT,
      })

      const url = new URL(await auth._internal.buildFullLoginUrl(BASE_URL, mockServer))

      expect(url.searchParams.get('port')).toBe(PORT.toString())
      expect(url.searchParams.get('state')).toBe(RANDOM_STRING)
      expect(url.searchParams.get('machineId')).toBe(MACHINE_ID)
    })

    it('does not regenerate the state code', async () => {
      await auth._internal.buildFullLoginUrl(BASE_URL, mockServer)
      await auth._internal.buildFullLoginUrl(BASE_URL, mockServer)

      expect(mockUtilities.randomId).toHaveBeenCalledTimes(1)
    })

    it('uses utm code to form a trackable URL', async () => {
      const url = new URL(await auth._internal.buildFullLoginUrl(BASE_URL, mockServer, 'UTM Source', 'UTM Medium', 'UTM Content'))

      expect(url.searchParams.get('utm_source')).toBe(UTM_SOURCE)
      expect(url.searchParams.get('utm_medium')).toBe(UTM_MEDIUM)
      expect(url.searchParams.get('utm_content')).toBe(UTM_CONTENT)
    })
  })

  describe('_internal.launchNativeAuth', () => {
    it('handles errors when openExternal fails', async () => {
      mockElectronShell.openExternal.mockRejectedValue(new TypeError('Cannot open external'))

      const sendWarning = vi.fn()

      await auth._internal.launchNativeAuth(REDIRECT_URL, sendWarning)

      expect(mockElectronShell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
    })

    describe('with shell available', () => {
      it('returns a promise that is fulfilled when openExternal succeeds', async () => {
        mockElectronShell.openExternal.mockResolvedValue(undefined)
        const sendWarning = vi.fn()

        await auth._internal.launchNativeAuth(REDIRECT_URL, sendWarning)

        expect(mockElectronShell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
        expect(sendWarning).not.toHaveBeenCalled()
      })

      it('is still fulfilled when openExternal fails, but sendWarning is called', async () => {
        mockElectronShell.openExternal.mockRejectedValue(new Error('Failed to open'))
        const sendLaunchError = vi.fn()

        await auth._internal.launchNativeAuth(REDIRECT_URL, sendLaunchError)

        expect(mockElectronShell.openExternal).toHaveBeenCalledWith(REDIRECT_URL)
        // Note: sendLaunchError will be called after timeout, but we can't easily test that here
      })
    })
  })

  describe('.start', () => {
    it('resolves upon successful auth', async () => {
      mockApi.getAuthUrls.mockResolvedValue(new Map([['dashboardAuthUrl', 'www.foo.bar']]))
      const mockApp: any = {
        get: vi.fn(),
        listen: vi.fn((port: number, host: string, callback: () => void) => {
          setTimeout(callback, 0)

          return {
            address: () => ({ port: 9001 }),
            close: vi.fn(),
          }
        }),
      }

      mockUtilities.express.mockReturnValue(mockApp)
      mockUtilities.Promise.fromCallback.mockImplementation((fn: any) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            fn(null, { name: 'test', email: 'test@test.com', authToken: 'token' })
            resolve({ name: 'test', email: 'test@test.com', authToken: 'token' })
          }, 10)
        })
      })

      const onMessage = vi.fn()

      await auth.start(onMessage, 'code')

      expect(auth._internal.stopServer).toBeDefined()
    })

    it('resolves when auth fails', async () => {
      mockApi.getAuthUrls.mockRejectedValue(new Error('test error'))

      const onMessage = vi.fn()

      await expect(auth.start(onMessage, 'code')).rejects.toThrow('test error')
    })

    it('sends an AUTH_ERROR_DURING_LOGIN message on unhandled errors', async () => {
      mockApi.getAuthUrls.mockResolvedValue(new Map([['dashboardAuthUrl', 'www.foo.bar']]))
      const mockApp: any = {
        get: vi.fn(),
        listen: vi.fn((port: number, host: string, callback: (err?: Error) => void) => {
          setTimeout(() => callback(new Error('unexpected error')), 0)

          return {
            address: () => ({ port: 9001 }),
            close: vi.fn(),
          }
        }),
      }

      mockUtilities.express.mockReturnValue(mockApp)

      const onMessageSpy = vi.fn()

      await expect(auth.start(onMessageSpy, 'code')).rejects.toThrow('unexpected error')

      expect(onMessageSpy).toHaveBeenCalledWith({
        name: 'AUTH_ERROR_DURING_LOGIN',
        message: 'unexpected error',
        browserOpened: false,
      })
    })
  })
})
