import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './app/providers/AppProvider'
import { App } from './app/App'
import './index.css'
import { registerPlaceholderActivity } from './engine/placeholder'
import { registerCoreActivities } from './features/Activity/registerActivities'

registerPlaceholderActivity();
registerCoreActivities();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
