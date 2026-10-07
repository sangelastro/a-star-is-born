import { defineConfig } from 'vite';

export default defineConfig({
    // Relative asset paths, so the build works both locally and under
    // https://<user>.github.io/<repo>/ on GitHub Pages
    base: './',
    server: {
        watch: {
            usePolling: true,
        },
    },
});
