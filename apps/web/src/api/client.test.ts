// apps/web/src/api/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchJson, ApiError } from './client.ts'

describe('fetchJson helper', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves with json data on successful response', async () => {
    const mockData = { ok: true, data: [1, 2, 3] }
    const mockResponse = new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    
    vi.mocked(fetch).mockResolvedValue(mockResponse)

    const result = await fetchJson('/api/test-endpoint')
    expect(fetch).toHaveBeenCalledWith('/api/test-endpoint', {
      credentials: 'same-origin',
      headers: {},
    })
    expect(result).toEqual(mockData)
  })

  it('throws ApiError on non-ok response', async () => {
    const errorData = { message: 'Something went wrong' }
    const mockResponse = new Response(JSON.stringify(errorData), {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'Content-Type': 'application/json' },
    })

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    await expect(fetchJson('/api/test-endpoint')).rejects.toThrow(ApiError)
  })

  it('attaches response body and status to ApiError', async () => {
    const errorData = { message: 'Invalid ID' }
    const mockResponse = new Response(JSON.stringify(errorData), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    try {
      await fetchJson('/api/test-endpoint')
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.body).toEqual(errorData)
      expect(apiErr.message).toBe('Request failed: 404')
    }
  })

  it('handles empty/malformed error bodies gracefully', async () => {
    const mockResponse = new Response('not a json', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })

    vi.mocked(fetch).mockResolvedValue(mockResponse)

    try {
      await fetchJson('/api/test-endpoint')
      expect(true).toBe(false)
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.status).toBe(500)
      expect(apiErr.body).toBeUndefined()
    }
  })
})
