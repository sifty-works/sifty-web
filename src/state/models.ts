import { useCallback, useEffect, useState } from 'react'
import {
  checkProvider,
  getModels,
  ModelsPatch,
  ModelsResponse,
  patchModels,
  ServerError,
} from '../api/client.ts'

export type ModelsState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; models: ModelsResponse }

export interface UseModelsResult {
  state: ModelsState
  error: string | null
  save: (patch: ModelsPatch) => Promise<void>
  check: (name: string) => Promise<void>
}

const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

function failure(err: unknown): string {
  return err instanceof ServerError ? err.message : OFFLINE_MESSAGE
}

export function useModels(): UseModelsResult {
  const [state, setState] = useState<ModelsState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getModels()
      .then((models) => { if (!cancelled) setState({ status: 'ok', models }) })
      .catch(() => { if (!cancelled) setState({ status: 'offline' }) })
    return () => { cancelled = true }
  }, [])

  const save = useCallback(async (patch: ModelsPatch): Promise<void> => {
    setError(null)
    try {
      setState({ status: 'ok', models: await patchModels(patch) })
    } catch (err) {
      setError(failure(err))
    }
  }, [])

  const check = useCallback(async (name: string): Promise<void> => {
    setError(null)
    try {
      const answer = await checkProvider(name)
      setState((prev) => prev.status !== 'ok' ? prev : {
        status: 'ok',
        models: {
          ...prev.models,
          providers: prev.models.providers.map(
            (p) => p.name === name ? { ...p, state: answer.state } : p,
          ),
        },
      })
    } catch (err) {
      setError(failure(err))
    }
  }, [])

  return { state, error, save, check }
}
