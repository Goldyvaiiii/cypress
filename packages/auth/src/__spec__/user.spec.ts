import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUser } from '../user'
import type { ApiClient, CacheClient } from '../types'

describe('user', () => {
  let mockApi: ApiClient
  let mockCache: CacheClient
  let user: ReturnType<typeof createUser>

  beforeEach(() => {
    mockApi = {
      getAuthUrls: vi.fn(),
      postLogout: vi.fn(),
    }

    mockCache = {
      getUser: vi.fn(),
      setUser: vi.fn(),
      removeUser: vi.fn(),
    }

    user = createUser({ api: mockApi, cache: mockCache })
  })

  describe('.get', () => {
    it('calls cache.getUser', async () => {
      const mockUser = { name: 'brian', email: 'brian@test.com', authToken: 'token' }

      ;(mockCache.getUser as any).mockResolvedValue(mockUser)

      const result = await user.get()

      expect(result).toEqual(mockUser)
      expect(mockCache.getUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('.logOut', () => {
    it('calls api.postLogout + removes the session from cache', async () => {
      ;(mockApi.postLogout as any).mockResolvedValue(undefined)

      ;(mockCache.getUser as any).mockResolvedValue({ name: 'brian', authToken: 'abc-123' })

      ;(mockCache.removeUser as any).mockResolvedValue(undefined)

      await user.logOut()

      expect(mockCache.removeUser).toHaveBeenCalledTimes(1)
      expect(mockApi.postLogout).toHaveBeenCalledWith('abc-123')
    })

    it('does not send to api.postLogout without a authToken', async () => {
      ;(mockCache.getUser as any).mockResolvedValue({ name: 'brian' })

      ;(mockCache.removeUser as any).mockResolvedValue(undefined)

      await user.logOut()

      expect(mockApi.postLogout).not.toHaveBeenCalled()
      expect(mockCache.removeUser).toHaveBeenCalledTimes(1)
    })

    it('removes the session from cache even if api.postLogout rejects', async () => {
      ;(mockApi.postLogout as any).mockRejectedValue(new Error('ECONNREFUSED'))

      ;(mockCache.getUser as any).mockResolvedValue({ name: 'brian', authToken: 'abc-123' })

      ;(mockCache.removeUser as any).mockResolvedValue(undefined)

      await expect(user.logOut()).rejects.toThrow('ECONNREFUSED')

      expect(mockCache.removeUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('.getBaseLoginUrl', () => {
    it('calls api.getAuthUrls and returns dashboardAuthUrl from Map', async () => {
      const authUrls = new Map([['dashboardAuthUrl', 'https://github.com/login']])

      ;(mockApi.getAuthUrls as any).mockResolvedValue(authUrls)

      const url = await user.getBaseLoginUrl()

      expect(url).toBe('https://github.com/login')
      expect(mockApi.getAuthUrls).toHaveBeenCalledTimes(1)
    })

    it('calls api.getAuthUrls and returns dashboardAuthUrl from plain object', async () => {
      const authUrls = { dashboardAuthUrl: 'https://github.com/login' }

      ;(mockApi.getAuthUrls as any).mockResolvedValue(authUrls)

      const url = await user.getBaseLoginUrl()

      expect(url).toBe('https://github.com/login')
      expect(mockApi.getAuthUrls).toHaveBeenCalledTimes(1)
    })
  })
})
