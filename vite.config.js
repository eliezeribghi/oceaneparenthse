import { defineConfig } from "vite";

import { svelte } from "@sveltejs/vite-plugin-svelte";
import compression from "vite-plugin-compression";
import { copy } from 'vite-plugin-copy'; // Importer le plugin copy
import assets from 'vite-plugin-assets';

export default defineConfig({
  plugins: [
  
    svelte(),
    assets({
      input: 'src/assets', // le dossier où vos images sont stockées
      output: 'dist/assets', // le dossier où vous voulez que vos images soient copiées
    }),
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
