import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ApplicationField, ChatMessage } from '../api/client.ts'
import { useApplicationChat } from '../state/application.ts'
import { failure } from '../state/messages.ts'
import { Refusal } from './Refusal.tsx'

export interface Discussion {
  key: string
  text: string
  nonce: number
}

interface Props {
  id: number
  fields: ApplicationField[]
  discussing: Discussion | null
  valuesOf: (key: string) => string[]
  onClear: () => void
  onUse: (key: string, values: string[]) => void
}

interface BubbleProps {
  role: ChatMessage['role']
  text: string
  label?: string
  proposal?: string[]
  onUse?: () => void
}

function Bubble({ role, text, label, proposal, onUse }: BubbleProps) {
  return (
    <li className={`app-bubble app-bubble-${role}`}>
      {text && <p>{text}</p>}
      {proposal && proposal.length > 0 && (
        <div className="app-proposal">
          <span className="app-label">{label}</span>
          <p className="app-answer">{proposal.join(', ')}</p>
          {onUse && <button onClick={onUse}>Use this</button>}
        </div>
      )}
    </li>
  )
}

export function ApplicationChat({ id, fields, discussing, valuesOf, onClear, onUse }: Props) {
  const { messages, pending, unsent, refusal, send } = useApplicationChat(id)
  const [message, setMessage] = useState('')
  const [seen, setSeen] = useState(0)
  const log = useRef<HTMLUListElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label ?? key

  if (discussing && discussing.nonce !== seen) {
    setSeen(discussing.nonce)
    const quoted = discussing.text
    setMessage((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${quoted}` : quoted))
  }

  useEffect(() => {
    const el = box.current
    if (!el || !seen) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [seen])

  useEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending, unsent, refusal])

  function submit() {
    const text = message.trim()
    if (!text || pending) return
    setMessage('')
    const key = discussing?.key ?? ''
    void send({ message: text, field: key, values: valuesOf(key) }).then((ok) => {
      if (!ok) setMessage((prev) => prev || text)
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    submit()
  }

  return (
    <aside className="app-chat">
      <h3 className="app-chat-title">Discuss the answers</h3>
      <ul className="app-chat-log" ref={log}>
        {messages.length === 0 && !pending && !unsent && (
          <li className="muted app-chat-empty">Write a comment, a question or a correction about the answers.</li>
        )}
        {messages.map((m) => (
          <Bubble
            key={m.position}
            role={m.role}
            text={m.text}
            label={labelOf(m.field)}
            proposal={m.proposal}
            onUse={m.role === 'model' && m.field ? () => onUse(m.field, m.proposal) : undefined}
          />
        ))}
        {unsent && <Bubble role="user" text={unsent.message} />}
        {pending && (
          <>
            <Bubble role="user" text={pending.message} />
            <Bubble role="model" text="Rewriting…" />
          </>
        )}
        {refusal && (
          <li className="app-chat-refusal">
            <Refusal note={failure(refusal)} />
          </li>
        )}
      </ul>
      <div className="app-chat-box">
        {discussing && (
          <p className="app-discussing">
            <span>Discussing: {labelOf(discussing.key)}</span>
            <button onClick={onClear} aria-label="Stop discussing this question">Clear</button>
          </p>
        )}
        <textarea
          ref={box}
          value={message}
          rows={4}
          placeholder="Message"
          aria-label="Message"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="primary" disabled={pending !== null || !message.trim()} onClick={submit}>Send</button>
      </div>
    </aside>
  )
}
