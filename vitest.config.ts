import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      '@lib': resolve(projectRoot, 'lib'),
    }
  },
  test: {
    globals: true,
    pool: 'forks',
    projects: [
      {
        // Frontend tests (React, jsdom)
        test: {
          name: 'frontend',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          globals: true,
        },
        resolve: {
          alias: {
            '@': resolve(projectRoot, 'src'),
            '@lib': resolve(projectRoot, 'lib'),
          },
        },
      },
      {
        // Backend tests (Netlify functions, Node environment)
        test: {
          name: 'backend',
          environment: 'node',
          include: ['netlify/**/*.test.{js,mjs}', 'lib/**/*.test.{js,mjs}'],
          globals: true,
        },
        resolve: {
          alias: {
            '@lib': resolve(projectRoot, 'lib'),
          },
        },
      },
    ],
  },
});
