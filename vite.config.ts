import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { blockchain: ['ethers'] } } } },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    watch: { ignored: ['**/.ipfs/**', '**/.tools/**', '**/artifacts/**', '**/cache/**', '**/out/**', '**/test-results/**'] },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
