import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

function getPackageName(id: string) {
  const normalized = id.split('node_modules/')[1];
  if (!normalized) return null;

  const segments = normalized.split('/');
  if (segments[0]?.startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0];
  }

  return segments[0];
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          const packageName = getPackageName(id);
          if (!packageName) return;

          if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
            return 'react-vendor';
          }

          if (packageName === 'framer-motion') {
            return 'motion-vendor';
          }

          if (
            packageName === 'sonner' ||
            packageName === 'next-themes' ||
            packageName === 'react-error-boundary'
          ) {
            return 'theme-vendor';
          }

          if (
            packageName === '@phosphor-icons/react' ||
            packageName === 'lucide-react' ||
            packageName === '@heroicons/react'
          ) {
            return 'icons-vendor';
          }

          if (
            packageName.startsWith('@radix-ui/') ||
            packageName === 'embla-carousel-react' ||
            packageName === 'vaul' ||
            packageName === 'cmdk'
          ) {
            return 'radix-vendor';
          }

          if (packageName === 'recharts' || packageName === 'd3') {
            return 'charts-vendor';
          }

          if (
            packageName === 'react-hook-form' ||
            packageName === '@hookform/resolvers' ||
            packageName === 'zod' ||
            packageName === 'react-day-picker' ||
            packageName === 'input-otp'
          ) {
            return 'form-vendor';
          }

          if (
            packageName === '@supabase/supabase-js' ||
            packageName === 'openai' ||
            packageName === '@google/generative-ai' ||
            packageName === 'octokit' ||
            packageName === '@octokit/core'
          ) {
            return 'service-vendor';
          }

          if (packageName === 'three') {
            return 'three-vendor';
          }

          if (
            packageName === 'clsx' ||
            packageName === 'tailwind-merge' ||
            packageName === 'class-variance-authority' ||
            packageName === 'date-fns' ||
            packageName === 'marked' ||
            packageName === 'uuid'
          ) {
            return 'utils-vendor';
          }

          return 'vendor';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
