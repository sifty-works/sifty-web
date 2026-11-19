import { useEffect, useState } from 'react'
import { getIndustries, IndustryItem, putIndustries, ServerError } from '../api/client.ts'

type EditItem = { uid: number; name: string; keywords: string[] }

let _uid = 0
function mkuid() { return ++_uid }

export function IndustriesPage() {
  const [items, setItems] = useState<EditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [kwDraft, setKwDraft] = useState<Record<number, string>>({})

  useEffect(() => {
    getIndustries()
      .then((resp) => {
        setItems(resp.industries.map((i) => ({ uid: mkuid(), name: i.name, keywords: i.keywords })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function addIndustry() {
    setItems((prev) => [...prev, { uid: mkuid(), name: '', keywords: [] }])
    setSaved(false)
  }

  function removeIndustry(uid: number) {
    setItems((prev) => prev.filter((i) => i.uid !== uid))
    setSaved(false)
  }

  function renameIndustry(uid: number, name: string) {
    setItems((prev) => prev.map((i) => i.uid === uid ? { ...i, name } : i))
    setSaved(false)
  }

  function addKeyword(uid: number) {
    const kw = (kwDraft[uid] ?? '').trim()
    if (!kw) return
    setItems((prev) => prev.map((i) => i.uid === uid ? { ...i, keywords: [...i.keywords, kw] } : i))
    setKwDraft((prev) => ({ ...prev, [uid]: '' }))
    setSaved(false)
  }

  function removeKeyword(uid: number, kwIndex: number) {
    setItems((prev) =>
      prev.map((i) => i.uid === uid ? { ...i, keywords: i.keywords.filter((_, idx) => idx !== kwIndex) } : i),
    )
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const industries: IndustryItem[] = items.map(({ name, keywords }) => ({ name, keywords }))
      await putIndustries(industries)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ServerError ? err.message : 'Could not save industries')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <form onSubmit={(e) => void handleSave(e)}>
      <h1>Industries</h1>
      <p className="lead">Keywords are matched against the title, tags and text of each vacancy to assign industries.</p>

      {items.map((item) => (
        <div key={item.uid} className="ind-row s-card">
          <div className="ind-row-head">
            <input
              className="ind-name"
              type="text"
              placeholder="Industry name"
              aria-label="Industry name"
              value={item.name}
              onChange={(e) => renameIndustry(item.uid, e.target.value)}
              required
            />
            <button type="button" onClick={() => removeIndustry(item.uid)}>Remove</button>
          </div>
          <div className="kw-chips">
            {item.keywords.map((kw, idx) => (
              <span key={idx} className="kw-chip">
                {kw}
                <button type="button" aria-label={`Remove keyword ${kw}`} onClick={() => removeKeyword(item.uid, idx)}>×</button>
              </span>
            ))}
          </div>
          <div className="ind-kw-add">
            <input
              type="text"
              placeholder="Add keyword"
              aria-label="New keyword"
              value={kwDraft[item.uid] ?? ''}
              onChange={(e) => setKwDraft((prev) => ({ ...prev, [item.uid]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(item.uid) } }}
            />
            <button type="button" onClick={() => addKeyword(item.uid)}>Add</button>
          </div>
        </div>
      ))}

      <button type="button" onClick={addIndustry} style={{ marginBottom: 20 }}>Add industry</button>

      <div className="ind-save-row">
        <button className="primary" type="submit" disabled={saving}>Save</button>
        {error && <span className="error">{error}</span>}
      </div>

      {saved && (
        <p className="banner" style={{ marginTop: 16 }}>Industries are being reassigned in the background.</p>
      )}
    </form>
  )
}
