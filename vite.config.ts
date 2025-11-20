import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Fix: Property 'cwd' does not exist on type 'Process'
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This polyfills process.env.API_KEY so your existing code works
      // It maps process.env.API_KEY to the VITE_API_KEY environment variable
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      'process.env': {}
    },
  };
});