import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './style.css'
import './role.css'
import './application.css'
import './theme.css'
import './polish.css'
import { Shell } from './views/Shell.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
)
