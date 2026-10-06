import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { homeServices, router } from './app/router'
import { HomeServicesProvider } from './features/home/home-services'
import { SnackbarProvider } from './components/ui/SnackbarProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnackbarProvider>
      <HomeServicesProvider value={homeServices}>
        <RouterProvider router={router} />
      </HomeServicesProvider>
    </SnackbarProvider>
  </StrictMode>,
)
