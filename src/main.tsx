import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import { assertNoSecrets } from './lib/env-guard'
import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './context/auth-context'
import { SettingsProvider } from './context/settings-context'
import { VoiceProvider } from './context/voice-context'
import { OrbAppearanceProvider } from './context/orb-appearance-context'
import ProtectedRoute from './components/ProtectedRoute'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Fail fast if secret keys leaked into the frontend bundle.
assertNoSecrets()

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AuthProvider>
      <ProtectedRoute>
        <SettingsProvider>
          <OrbAppearanceProvider>
            <VoiceProvider>
              <App />
            </VoiceProvider>
          </OrbAppearanceProvider>
        </SettingsProvider>
      </ProtectedRoute>
    </AuthProvider>
  </ErrorBoundary>
)
