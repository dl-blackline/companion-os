import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './context/auth-context'
import { VoiceProvider } from './context/voice-context'
import ProtectedRoute from './components/ProtectedRoute'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AuthProvider>
      <ProtectedRoute>
        <VoiceProvider>
          <App />
        </VoiceProvider>
      </ProtectedRoute>
    </AuthProvider>
  </ErrorBoundary>
)
