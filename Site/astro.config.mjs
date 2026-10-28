import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every build checks itself before it counts as built, on the directory this build wrote (npm run build, build:sitio and --outDir alike;
// build:sitio calls `astro build` directly, so npm's prebuild never runs there): the dates (scripts/check-fechas.mjs), then the home's claims
// (scripts/check-hero-estado.mjs: it claims only what the build can back, and no page ships without the atlas data files). A failure fails the build.
const correr = (script, args = []) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', fileURLToPath(new URL(script, import.meta.url)), ...args], { stdio: 'inherit' });
const comprobarPortada = {
  name: 'comprobar-portada',
  hooks: {
    'astro:build:done': ({ dir }) => {
      // a build that fails a check leaves nothing behind that could be deployed
      const falla = (motivo) => { rmSync(fileURLToPath(dir), { recursive: true, force: true }); throw new Error(motivo); };
      if (correr('./scripts/check-fechas.mjs').status !== 0) falla('check-fechas: a published date breaks its rules (see above); the output was removed');
      if (correr('./scripts/check-hero-estado.mjs', ['--dist', fileURLToPath(dir)]).status !== 0) falla('check-hero-estado: the home claims something this build cannot back (see above); the output was removed');
    },
  },
};

export default defineConfig({
  site: 'https://axolodao.org',
  output: 'static',
  integrations: [
    preact({ compat: false }),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      i18n: {
        defaultLocale: 'es',
        locales: { es: 'es-MX', en: 'en-US', pt: 'pt-BR' },
      },
    }),
    comprobarPortada,
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
