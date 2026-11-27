import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkProvider,
  getModels,
  ModelsPatch,
  ModelsResponse,
  patchModels,
  ServerError,
} from '../api/client.ts'
import { announce, failure, retract, silent } from './messages.ts'

export type ModelsState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ok'; models: ModelsResponse }

export interface UseModelsResult {
  state: ModelsState
  save: (patch: ModelsPatch) => Promise<void>
  check: (name: string) => Promise<void>
}

const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

function trouble(err: unknown) {
  announce(failure(err instanceof ServerError ? err : OFFLINE_MESSAGE), 'models')
}

export function useModels(refreshMs = 0): UseModelsResult {
  const [state, setState] = useState<ModelsState>({ status: 'loading' })
  const chain = useRef<Promise<void>>(Promise.resolve())
  const checkSeq = useRef(new Map<string, number>())

  useEffect(() => {
    let cancelled = false
    const load = () => {
      chain.current = chain.current.then(async () => {
        try {
          const models = await getModels()
          if (!cancelled) setState({ status: 'ok', models })
        } catch {
          if (!cancelled) setState({ status: 'offline' })
        }
      })
    }
    load()
    const timer = refreshMs > 0 ? window.setInterval(load, refreshMs) : 0
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [refreshMs])

  const save = useCallback((patch: ModelsPatch): Promise<void> => {
    const run = chain.current.then(async () => {
      try {
        const models = await patchModels(patch)
        setState({ status: 'ok', models })
        retract('models')
      } catch (err) {
        trouble(err)
        await getModels().then((models) => setState({ status: 'ok', models }), silent('the re-read after a failed save has nothing of its own to say: the save failure already spoke'))
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
      retract('models')
    } catch (err) {
      if (seq === checkSeq.current.get(name)) trouble(err)
    }
  }, [])

  return { state, save, check }
}
