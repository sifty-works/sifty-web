import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getApplication, getApplicationChat, OfflineError, patchApplicationField, retryApplication, sendApplicationChat,
  ServerError, type ApplicationView, type ChatMessage, type ChatSend,
} from '../api/client.ts'
import { announce, describe, failure, retract } from './messages.ts'

export type ApplicationState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; view: ApplicationView }

const POLL_MS = 3000
const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

export const RETRY_ACTION = 'Retry preparation'
export const DIRECT_ACTION = 'Apply directly'

export function useApplication(id: number) {
  const [state, setState] = useState<ApplicationState>({ status: 'loading' })
  const latest = useRef(0)
  const loaded = useRef(false)

  const reload = useCallback(async () => {
    const mine = ++latest.current
    try {
      const view = await getApplication(id)
      if (mine !== latest.current) return
      loaded.current = true
      setState({ status: 'ok', view })
      retract('application')
    } catch (err) {
      if (mine !== latest.current) return
      const message = err instanceof OfflineError ? OFFLINE_MESSAGE : describe(err, 'Could not load the application')
      if (loaded.current) announce(failure(message), 'application')
      else setState({ status: 'error', message })
    }
  }, [id])

  useEffect(() => {
    loaded.current = false
    setState({ status: 'loading' })
    void reload()
    return () => { latest.current++; retract('application') }
  }, [reload])

  const reading = state.status === 'ok' && state.view.state === 'reading'
  useEffect(() => {
    if (!reading) return
    const timer = setTimeout(() => { void reload() }, POLL_MS)
    return () => clearTimeout(timer)
  }, [reading, state, reload])

  const retry = useCallback(async () => {
    try {
      const view = await retryApplication(id)
      latest.current++
      setState({ status: 'ok', view })
    } catch (err) {
      announce(failure(err instanceof ServerError ? err : null, 'Could not retry the preparation'), 'application')
    }
  }, [id])

  const save = useCallback(async (field: string, values: string[], revision: number): Promise<string | null> => {
    try {
      const view = await patchApplicationField(id, field, values, revision)
      latest.current++
      setState({ status: 'ok', view })
      return null
    } catch (err) {
      if (err instanceof ServerError) {
        void reload()
        return err.message
      }
      return err instanceof OfflineError ? OFFLINE_MESSAGE : describe(err, 'Could not save')
    }
  }, [id, reload])

  return { state, retry, save }
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof OfflineError ? OFFLINE_MESSAGE : describe(err, fallback)

export function useApplicationChat(id: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState<ChatSend | null>(null)
  const [unsent, setUnsent] = useState<ChatSend | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const latest = useRef(0)
  const count = useRef(0)

  const load = useCallback(async (): Promise<ChatMessage[] | null> => {
    const mine = ++latest.current
    try {
      const chat = await getApplicationChat(id)
      if (mine !== latest.current) return null
      count.current = chat.messages.length
      setMessages(chat.messages)
      return chat.messages
    } catch (err) {
      if (mine === latest.current) setRefusal(errorText(err, 'Could not load the conversation'))
      return null
    }
  }, [id])

  useEffect(() => {
    void load()
    return () => { latest.current++ }
  }, [load])

  const send = useCallback(async (item: ChatSend): Promise<boolean> => {
    const before = count.current
    setPending(item)
    setUnsent(null)
    setRefusal(null)
    try {
      const chat = await sendApplicationChat(id, item)
      latest.current++
      count.current = chat.messages.length
      setMessages(chat.messages)
      setPending(null)
      return true
    } catch (err) {
      setRefusal(errorText(err, 'The model could not answer'))
      setUnsent(item)
      setPending(null)
      const after = await load()
      if (after && after.length > before) setUnsent(null)
      return false
    }
  }, [id, load])

  return { messages, pending, unsent, refusal, send }
}
