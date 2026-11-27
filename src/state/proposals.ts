import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acceptProposal, listProposals, OfflineError, rejectProposal, type ProposalItem, type ProposalListResp,
} from '../api/client.ts'
import { OFFLINE_MESSAGE, trouble } from './documents.ts'
import { announce, describe, retract, type Note } from './messages.ts'

const FADE_MS = 450

export interface ProposalRow {
  item: ProposalItem
  leaving: boolean
}

export interface UseProposalsResult {
  status: 'loading' | 'error' | 'ok'
  note: Note | null
  rows: ProposalRow[]
  count: number
  reload: () => Promise<void>
  accept: (id: number) => Promise<void>
  reject: (id: number) => Promise<void>
}

export function useProposals(onAccepted: () => void): UseProposalsResult {
  const [status, setStatus] = useState<UseProposalsResult['status']>('loading')
  const [note, setNote] = useState<Note | null>(null)
  const [current, setCurrent] = useState<ProposalItem[]>([])
  const [held, setHeld] = useState<ProposalItem[]>([])
  const latest = useRef(0)
  const loaded = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const apply = useCallback((list: ProposalItem[]) => {
    clearTimeout(timer.current)
    latest.current++
    setCurrent(list)
    setHeld((prev) => {
      const fresh = new Map(list.map((p) => [p.id, p]))
      const kept = prev.map((p) => fresh.get(p.id) ?? p)
      return [...kept, ...list.filter((p) => !prev.some((q) => q.id === p.id))]
    })
    timer.current = setTimeout(() => setHeld(list), FADE_MS)
  }, [])

  const reload = useCallback(async () => {
    const mine = ++latest.current
    try {
      const data = await listProposals()
      if (mine !== latest.current) return
      loaded.current = true
      apply(data.proposals)
      setStatus('ok')
      setNote(null)
      retract('suggestions')
    } catch (err) {
      if (mine !== latest.current) return
      if (loaded.current) announce(trouble(err, 'Could not refresh suggestions'), 'suggestions')
      else {
        setStatus('error')
        setNote({ kind: 'failure', text: err instanceof OfflineError ? OFFLINE_MESSAGE : describe(err, 'Could not load suggestions') })
      }
    }
  }, [apply])

  useEffect(() => {
    void reload()
    return () => { latest.current++; clearTimeout(timer.current) }
  }, [reload])

  const settle = useCallback(async (call: () => Promise<ProposalListResp>, accepted: boolean) => {
    apply((await call()).proposals)
    retract('suggestions')
    if (accepted) onAccepted()
  }, [apply, onAccepted])

  const accept = useCallback((id: number) => settle(() => acceptProposal(id), true), [settle])
  const reject = useCallback((id: number) => settle(() => rejectProposal(id), false), [settle])

  const live = new Set(current.map((p) => p.id))
  const rows = held.map((item) => ({ item, leaving: !live.has(item.id) }))

  return { status, note, rows, count: current.length, reload, accept, reject }
}
