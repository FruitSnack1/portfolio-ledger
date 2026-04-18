import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ThemeProvider } from './theme/ThemeProvider'
import './index.css'

const el = document.getElementById('root')
if (!el) throw new Error('Root element #root not found')

createRoot(el).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
)
