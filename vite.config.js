import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import compression from "vite-plugin-compression";
import {copy} from 'vite-plugin-copy'; // Importer le plugin copy

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
    }),
    copy({
      targets: [
        // Copier les images du répertoire src/assets vers dist/assets
        { src: 'src/assets', dest: 'dist/assets' },
      ],
      // Options facultatives
      verbose: true, // Afficher les détails de la copie dans la console
    }),
  ],
  optimizeDeps: {
    include: ['swiper'],
  },
});
