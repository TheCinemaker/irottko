import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// DEV_HTTPS=1 → self-signed https dev server, so phones on the same Wi-Fi
// can use the camera (the scanner). Browsers only allow the camera on https.
const devHttps = process.env.DEV_HTTPS === '1';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(devHttps ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: true,
    // Dev only: functions run via scripts/dev-functions.mjs (npm run dev:functions)
    proxy: { '/.netlify/functions': 'http://localhost:9999' }
  }
});
