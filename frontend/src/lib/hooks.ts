import { useEffect, useMemo } from 'react'

/** A blob: URL for a local file preview, revoked when the file changes or on unmount. */
export function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}
