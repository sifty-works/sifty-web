import { useCallback, useEffect, useRef, useState } from 'react'
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
  const chain = useRef<Promise<void>>(Promise.resolve())
  const checkSeq = useRef(new Map<string, number>())

  useEffect(() => {
    let cancelled = false
    chain.current = chain.current.then(async () => {
      try {
        const models = await getModels()
        if (!cancelled) setState({ status: 'ok', models })
      } catch {
        if (!cancelled) setState({ status: 'offline' })
      }
    })
    return () => { cancelled = true }
  }, [])

  const save = useCallback((patch: ModelsPatch): Promise<void> => {
    const run = chain.current.then(async () => {
      try {
        const models = await patchModels(patch)
        setState({ status: 'ok', models })
        setError(null)
      } catch (err) {
        setError(failure(err))
        await getModels().then((models) => setState({ status: 'ok', models }), () => {})
      }
    })
    chain.current = run
    return run
  }, [])

  const check = useCallback(async (name: string): Promise<void> => {
    const seq = (checkSeq.current.get(name) ?? 0) + 1
    checkSeq.current.set(name, seq)
    try {
      const answer = await checkProvider(name)
      if (seq !== checkSeq.current.get(name)) return
      setState((prev) => prev.status !== 'ok' ? prev : {
        status: 'ok',
        models: {
          ...prev.models,
          providers: prev.models.providers.map(
            (p) => p.name === name ? { ...p, state: answer.state } : p,
          ),
        },
      })
      setError(null)
    } catch (err) {
      if (seq === checkSeq.current.get(name)) setError(failure(err))
    }
  }, [])

  return { state, error, save, check }
}
