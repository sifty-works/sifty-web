export const OFFLINE_TEXT = 'Sifty is not running. Start it and refresh the page.'

export function OfflineNotice() {
  return <p className="muted">{OFFLINE_TEXT}</p>
}
