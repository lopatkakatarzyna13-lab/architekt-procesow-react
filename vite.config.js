import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const workshopLocal = mode === 'workshop-local'

  return {
    plugins: [react()],
    optimizeDeps: {
      include: ['bpmn-js/lib/draw/TextRenderer', 'bpmn-js/lib/NavigatedViewer', 'bpmn-js/lib/Viewer', 'bpmn-moddle'],
    },
    ...(workshopLocal ? {
      envDir: false,
      envPrefix: 'WORKSHOP_LOCAL_',
      build: { outDir: 'dist-workshop' },
      preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    } : {
      server: { proxy: { '/api/analyze-workshop': 'http://127.0.0.1:8787' } },
    }),
  }
})
