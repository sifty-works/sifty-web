export function localTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  title: string
  empty: string
  columns: string[]
  rows: { key: string | number; cells: string[] }[]
}

export function WorkSection({ title, empty, columns, rows }: Props) {
  return (
    <section className="s-card">
      <h2>{title}</h2>
      {rows.length === 0
        ? <p className="muted">{empty}</p>
        : (
          <table className="sites-table work-table">
            <thead>
              <tr>
                {columns.map((name) => <th key={name}>{name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, i) => <td key={columns[i]}>{cell || <span className="muted">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  )
}
