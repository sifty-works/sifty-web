import { InboxList } from './InboxList.tsx'

export function Shell() {
  return (
    <div className="shell">
      <header className="shell-header">
        <h1 className="shell-title">Sifty</h1>
      </header>
      <div className="shell-body">
        <InboxList />
      </div>
    </div>
  )
}
