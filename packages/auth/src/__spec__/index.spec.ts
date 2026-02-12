import { describe, it, expect } from 'vitest'
import { auth } from '../index'

describe('auth', () => {
  describe('auth function', () => {
    it('is defined', () => {
      expect(auth).toBeDefined()
      expect(typeof auth).toBe('function')
    })
  })
})
