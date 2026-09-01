import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
      },
      // Export endpoints live on the backend; proxy so the frontend origin can
      // call them without CORS friction in dev.
      '/export': {
        target: 'http://localhost:4100',
        changeOrigin: true,
        bypass(req) {
          // The hidden print-render route is served by the frontend itself.
          if (req.url?.startsWith('/export-render/')) return req.url;
          return undefined;
        },
      },
    },
  },
});
