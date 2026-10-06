/**
 * Thin API client. Same-origin requests carry the HttpOnly session cookie; every
 * call adds the custom header the backend requires for CSRF protection.
 */
const CSRF = { 'X-Requested-With': 'to-my-petal' }

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const FALLBACK: Record<number, string> = {
  0: "We couldn't reach the server. Check your connection and try again.",
  401: 'Please sign in to continue.',
  404: "We couldn't find that.",
  413: 'This file is too large.',
  429: 'Too many attempts. Please wait a moment.',
  500: 'Something went wrong on our side. Please try again.',
}

type Detail = string | { code?: string; message?: string } | Array<{ msg: string; loc?: (string | number)[] }>

function messageFrom(status: number, detail: Detail | undefined): { message: string; code?: string } {
  if (typeof detail === 'string') return { message: detail }
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const field = first.loc?.[first.loc.length - 1]
    const msg = first.msg.replace(/^Value error, /, '')
    return { message: field && typeof field === 'string' ? `${humanField(field)}: ${msg}` : msg }
  }
  if (detail && !Array.isArray(detail) && detail.message) return { message: detail.message, code: detail.code }
  return { message: FALLBACK[status] ?? FALLBACK[500] }
}

function humanField(f: string) {
  return f.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init
  let res: Response
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      ...rest,
      headers: { ...CSRF, ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
  } catch {
    throw new ApiError(0, FALLBACK[0])
  }
  if (res.status === 204) return undefined as T
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => undefined) : undefined
  if (!res.ok) {
    const { message, code } = messageFrom(res.status, body?.detail)
    throw new ApiError(res.status, message, code)
  }
  return body as T
}

export interface UploadHandle<T> {
  promise: Promise<T>
  abort: () => void
}

/** Multipart upload with real (measured) byte progress via XMLHttpRequest. */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (fraction: number | null) => void,
): UploadHandle<T> {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open('POST', path)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', CSRF['X-Requested-With'])
    xhr.upload.onprogress = (e) => onProgress(e.lengthComputable ? e.loaded / e.total : null)
    xhr.onload = () => {
      let body: { detail?: Detail } | undefined
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = undefined
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T)
      else {
        const { message, code } = messageFrom(xhr.status, body?.detail)
        reject(new ApiError(xhr.status, message, code))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, FALLBACK[0]))
    xhr.onabort = () => reject(new ApiError(-1, 'Upload cancelled.'))
    xhr.send(form)
  })
  return { promise, abort: () => xhr.abort() }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return FALLBACK[500]
}
