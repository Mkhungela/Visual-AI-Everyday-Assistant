import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element missing from index.html')
}

// The server-rendered boot placeholder lives inside #root; React replaces it.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
