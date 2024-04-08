import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import compression from "vite-plugin-compression";


export default defineConfig({
  plugins: [
    vue(),
    svelte(),
 
    compression({
      verbose: true,
      filter: /\.(js|css|json|txt|html|svg)$/,
      deleteOriginFile: false,
      algorithm: 'gzip',
      ext: '.gz'
    })
  ],
  optimizeDeps: {
    include: ['swiper'],
  },
});

