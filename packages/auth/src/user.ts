import type { CachedUser } from '@packages/types'
import type Bluebird from 'bluebird'
import type { ApiClient, CacheClient } from './types'

/**
 * User module for authentication user operations
 * Uses dependency injection for API and cache access
 */
export function createUser (dependencies: { api: ApiClient, cache: CacheClient }) {
  const { api, cache } = dependencies

  return {
    /**
     * Get the cached user
     */
    get (): Bluebird<CachedUser> {
      return cache.getUser()
    },

    /**
     * Set the cached user
     */
    set (user: CachedUser): Bluebird<void> {
      return cache.setUser(user)
    },

    /**
     * Get the base login URL from the API
     */
    getBaseLoginUrl (): Bluebird<string> {
      return api.getAuthUrls().then((urls) => {
        // Handle both Map and plain object responses
        if (urls instanceof Map) {
          return urls.get('dashboardAuthUrl') || ''
        }

        return (urls as any).dashboardAuthUrl || ''
      })
    },

    /**
     * Log out the user by removing from cache and calling API
     */
    logOut (): Bluebird<void> {
      return this.get().then((user) => {
        const authToken = user && user.authToken

        return cache.removeUser().then(() => {
          if (authToken) {
            return api.postLogout(authToken)
          }

          return undefined
        })
      })
    },
  }
}
