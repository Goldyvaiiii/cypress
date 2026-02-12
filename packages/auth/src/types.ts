import type { CachedUser } from '@packages/types'
import type Bluebird from 'bluebird'

/**
 * Interface for API operations needed by auth module
 */
export interface ApiClient {
  /**
   * Get authentication URLs from the API
   * @returns Promise resolving to a Map with 'dashboardAuthUrl' key
   */
  getAuthUrls(): Bluebird<Map<string, string>>

  /**
   * Post logout request to the API
   * @param authToken The authentication token to logout
   * @returns Promise that resolves when logout is complete
   */
  postLogout(authToken: string): Bluebird<void>
}

/**
 * Interface for cache operations needed by auth module
 */
export interface CacheClient {
  /**
   * Get the cached user
   * @returns Promise resolving to the cached user
   */
  getUser(): Bluebird<CachedUser>

  /**
   * Set the cached user
   * @param user The user to cache
   * @returns Promise that resolves when user is cached
   */
  setUser(user: CachedUser): Bluebird<void>

  /**
   * Remove the cached user
   * @returns Promise that resolves when user is removed
   */
  removeUser(): Bluebird<void>
}

/**
 * Interface for Electron shell operations
 */
export interface Electron {
  shell: {
    openExternal: (url: string) => Promise<void>
  }
}

/**
 * Container type for all dependencies needed by the auth module
 */
export interface AuthDependencies {
  api: ApiClient
  cache: CacheClient
  electron: Electron
  randomId: (length?: number) => string
}
