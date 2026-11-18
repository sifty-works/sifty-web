import { useEffect, useState } from 'react'
import { previewExclusion } from '../api/client.ts'
import { useExclusions } from '../state/exclusions.ts'

export function ExclusionsPage() {
  const { state, add, remove, addError } = useExclusions()
  const [kind, setKind] = useState<'word' | 'company'>('word')
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      setPreview('')
      return
    }
    let cancelled = false
    previewExclusion(kind, trimmed)
      .then((d) => { if (!cancelled) setPreview(d.text) })
      .catch(() => { if (!cancelled) setPreview('') })
    return () => { cancelled = true }
  }, [kind, value])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const ok = await add(kind, value.trim())
    if (ok) {
      setValue('')
      setPreview('')
    }
  }

  const exclusions = state.status === 'ok' ? state.exclusions : []

  return (
    <section className="settings-section">
      <h2 className="settings-heading">Exclusions</h2>

      <form className="add-source-form" onSubmit={(e) => void handleAdd(e)}>
        <fieldset className="add-source-fields">
          <select
            className="form-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'word' | 'company')}
            aria-label="Kind"
          >
            <option value="word">Word</option>
            <option value="company">Company</option>
          </select>
          <input
            className="form-input"
            type="text"
            placeholder={kind === 'word' ? 'Word or phrase in title or company' : 'Company name'}
            aria-label="Exclusion value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
          <button className="btn-primary" type="submit">
            Add
          </button>
        </fieldset>
        {preview && <p className="form-hint">{preview}</p>}
        {addError && <p className="form-error">{addError}</p>}
      </form>

      {exclusions.length > 0 && (
        <table className="sources-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Value</th>
              <th>Scope</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {exclusions.map((ex) => (
              <tr key={ex.id}>
                <td>{ex.kind}</td>
                <td>{ex.value}</td>
                <td>{ex.scope}</td>
                <td>
                  <button className="btn-link" onClick={() => void remove(ex.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
