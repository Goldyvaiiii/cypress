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
export interface ElectronShell {
  /**
   * Open an external URL in the default browser
   * @param url The URL to open
   * @returns Promise that resolves when the URL is opened
   */
  openExternal(url: string): Promise<void>
}

/**
 * Type for machine ID provider function from node-machine-id
 */
export type MachineIdProvider = () => Promise<string | null>

/**
 * Utility functions needed by auth module
 */
export interface AuthUtilities {
  /**
   * Generate a random ID string
   * @param length Length of the random ID
   * @returns Random ID string
   */
  randomId: (length?: number) => string

  /**
   * Get the OS platform
   * @returns Platform string (e.g., 'linux', 'darwin', 'win32')
   */
  osPlatform: () => string

  /**
   * Get the Cypress package version
   * @returns Version string
   */
  cypressVersion: string

  /**
   * Lodash utility functions
   */
  lodash: {
    pick: <T extends object, K extends keyof T>(object: T, ...keys: K[]) => Pick<T, K>
    get: <T = any>(object: any, path: string, defaultValue?: T) => T
  }

  /**
   * Express application factory
   */
  express: () => any

  /**
   * Debug logger factory
   */
  debug: (namespace: string) => (...args: any[]) => void

  /**
   * URL parsing utilities
   */
  url: {
    parse: (urlString: string) => any
    format: (urlObject: any) => string
  }

  /**
   * Bluebird Promise utilities
   */
  Promise: {
    fromCallback: <T>(fn: (callback: (err: any, result?: T) => void) => void) => Bluebird<T>
    method: <T extends (...args: any[]) => any>(fn: T) => T
    resolve: <T>(value?: T) => Bluebird<T>
  }
}

/**
 * Container type for all dependencies needed by the auth module
 */
export interface AuthDependencies {
  api: ApiClient
  cache: CacheClient
  electronShell: ElectronShell
  machineId: MachineIdProvider
  utilities: AuthUtilities
}
