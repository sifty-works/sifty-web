// Shown as the settings page fallback when the server is unreachable.
// In the lists, the striped banner in InboxList is used instead.
export function OfflineNotice() {
  return (
    <div className="settings-page">
      <div className="settings-nav" />
      <div className="settings-main">
        <div className="settings-content">
          <p className="muted">Sifty is not running. Start it and refresh the page.</p>
        </div>
      </div>
    </div>
  )
}
