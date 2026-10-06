import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('api()', () => {
  it('sends the CSRF header and JSON body', async () => {
    mockFetch(200, { ok: true })
    await api('/api/x', { method: 'POST', json: { a: 1 } })
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.headers['X-Requested-With']).toBe('to-my-petal')
    expect(init.body).toBe('{"a":1}')
  })

  it('surfaces upload validation messages and codes', async () => {
    mockFetch(422, { detail: { code: 'too_small', message: 'This photo is only 60×60 pixels.' } })
    await expect(api('/api/photos')).rejects.toMatchObject({ status: 422, code: 'too_small', message: 'This photo is only 60×60 pixels.' })
  })

  it('turns pydantic errors into a readable sentence', async () => {
    mockFetch(422, { detail: [{ loc: ['body', 'entry_date'], msg: "Value error, Journal entries can't be dated in the future." }] })
    await expect(api('/api/journal')).rejects.toThrow("Entry date: Journal entries can't be dated in the future.")
  })

  it('explains network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed'))))
    const err = await api('/api/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
    expect(err.message).toMatch(/couldn't reach the server/)
  })
})
