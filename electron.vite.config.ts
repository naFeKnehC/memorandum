import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: { input: path.join(__dirname, 'src/main/index.ts') }
    },
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: path.join(__dirname, 'src/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      outDir: 'dist/renderer'
    },
    resolve: {
      alias: {
        '@renderer': path.join(__dirname, 'src/renderer/src'),
        '@main': path.join(__dirname, 'src/main'),
        '@preload': path.join(__dirname, 'src/preload'),
        '@types': path.join(__dirname, 'types')
      }
    },
    plugins: [react()]
  }
})
