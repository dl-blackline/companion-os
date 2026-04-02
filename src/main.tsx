import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import { assertNoSecrets } from './lib/env-guard'
import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { AuthProvider } from './context/auth-context'
import { SettingsProvider } from './context/settings-context'
import { VoiceProvider } from './context/voice-context'
import { OrbAppearanceProvider } from './context/orb-appearance-context'
import { AIControlProvider } from './context/ai-control-context'
import { AccentLightingProvider } from './context/accent-lighting-context'
import ProtectedRoute from './components/ProtectedRoute'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// Log (but don't crash) if secret keys leaked into the frontend bundle.
try {
  assertNoSecrets()
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <AuthProvider>
      <ProtectedRoute>
        <AIControlProvider>
          <SettingsProvider>
            <AccentLightingProvider>
              <OrbAppearanceProvider>
                <VoiceProvider>
                  <App />
                </VoiceProvider>
              </OrbAppearanceProvider>
            </AccentLightingProvider>
          </SettingsProvider>
        </AIControlProvider>
      </ProtectedRoute>
    </AuthProvider>
  </ErrorBoundary>
)
