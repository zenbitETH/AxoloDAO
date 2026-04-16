import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://axolodao.org',
  output: 'static',
  integrations: [
    preact({ compat: false }),
    tailwind({ applyBaseStyles: false }),
  ],
  i18n: {
    defaultLocale: 'es',
    locales: ['es', 'en', 'pt'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
    fallback: { en: 'es', pt: 'es' },
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
