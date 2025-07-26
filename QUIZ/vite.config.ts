import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Ensure environment variables are available at build time
    'process.env.NEXT_PUBLIC_BACKEND_STRICT': JSON.stringify(process.env.NEXT_PUBLIC_BACKEND_STRICT),
    'process.env.NEXT_PUBLIC_BACKEND_URL': JSON.stringify(process.env.NEXT_PUBLIC_BACKEND_URL),
    'process.env.NEXT_PUBLIC_BACKEND_WS_URL': JSON.stringify(process.env.NEXT_PUBLIC_BACKEND_WS_URL),
  },
});
