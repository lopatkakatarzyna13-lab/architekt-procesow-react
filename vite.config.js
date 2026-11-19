import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['bpmn-js/lib/draw/TextRenderer', 'bpmn-js/lib/NavigatedViewer', 'bpmn-js/lib/Viewer', 'bpmn-moddle'],
  },
  server: { proxy: { '/api/analyze-workshop': 'http://127.0.0.1:8787' } },
})
