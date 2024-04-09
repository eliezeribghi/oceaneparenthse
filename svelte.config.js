import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";


const config = {
    kit: {
        adapter: adapter(),
    },
    // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
    // for more information about preprocessors
    preprocess: [vitePreprocess({})],
};

export default config;
