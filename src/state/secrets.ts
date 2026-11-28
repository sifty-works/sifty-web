import { useCallback, useEffect, useState } from 'react'
import {
  deleteSecret,
  getSecrets,
  putSecret,
  SecretView,
  ServerError,
} from '../api/client.ts'
import { announce, failure, retract, type Note } from './messages.ts'

export interface UseSecretsResult {
  keys: SecretView[]
  save: (name: string, value: string) => Promise<Note | null>
  remove: (name: string) => Promise<Note | null>
}

const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

export function useSecrets(): UseSecretsResult {
  const [keys, setKeys] = useState<SecretView[]>([])

  useEffect(() => {
    let cancelled = false
    getSecrets().then(
      (data) => { if (!cancelled) setKeys(data.keys) },
      () => { if (!cancelled) setKeys([]) },
    )
    return () => { cancelled = true }
  }, [])

  const change = useCallback(async (call: () => ReturnType<typeof getSecrets>): Promise<Note | null> => {
    try {
      setKeys((await call()).keys)
      retract('secrets')
      return null
    } catch (err) {
      if (err instanceof ServerError) return failure(err)
      announce(failure(OFFLINE_MESSAGE), 'secrets')
      return null
    }
  }, [])

  const save = useCallback((name: string, value: string) => change(() => putSecret(name, value)), [change])
  const remove = useCallback((name: string) => change(() => deleteSecret(name)), [change])

  return { keys, save, remove }
}
