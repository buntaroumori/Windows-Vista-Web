import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'production-csp',
      apply: 'build',
      transformIndexHtml(html) {
        return html.replace("connect-src 'self' ws: wss:;", "connect-src 'self';");
      },
    },
  ],
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true, port: 4173, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
  },
});
