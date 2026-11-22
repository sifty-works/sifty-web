import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkProvider,
  getModels,
  ModelsPatch,
  ModelsResponse,
  patchModels,
  ServerError,
} from '../api/client.ts'
import { failure, type Note } from './messages.ts'

export type ModelsState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; models: ModelsResponse }

export interface UseModelsResult {
  state: ModelsState
  note: Note | null
  save: (patch: ModelsPatch) => Promise<void>
  check: (name: string) => Promise<void>
}

const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

function trouble(err: unknown): Note {
  return failure(err instanceof ServerError ? err : OFFLINE_MESSAGE)
}

export function useModels(): UseModelsResult {
  const [state, setState] = useState<ModelsState>({ status: 'loading' })
  const [note, setNote] = useState<Note | null>(null)
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
        setNote(null)
      } catch (err) {
        setNote(trouble(err))
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
      setNote(null)
    } catch (err) {
      if (seq === checkSeq.current.get(name)) setNote(trouble(err))
    }
  }, [])

  return { state, note, save, check }
}
