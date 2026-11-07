// The only way axolodao.org reaches production: a prebuilt upload of `npm run build:sitio`, from a clean tree whose HEAD is origin/main, with
// the commit recorded on the deployment (`vercel inspect axolodao.org` then says which commit is live). Vercel skips every Git-triggered build
// (vercel.json `ignoreCommand`), so production never comes from anything else. On 2026-10-25 a merge to main rebuilt production from a main
// that was behind what was live, because what was live had been uploaded from a branch that was never pushed; this refuses that.
//   HUB_BUILD_URL=… HUB_KEY_FILE=… HUB_KEY_HEADER=… HUB_KEY_SCHEME=… BRAIN_HUB_DATOS=… AXOLODAO_PERSONAS_CLAVE=… npm run deploy:sitio
// Between the build and the upload, the embargo check reads what was built (test:no-embargo-in-dist); it needs AXOLODAO_PERSONAS_CLAVE and refuses
// the deploy without it.
//   VERCEL_BIN (default `vercel`) picks the CLI. It leaves the deployment as production; the domains move with `vercel promote` if they did not.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arbolSucio } from './lib/construccionSitio.mjs';

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// the Vercel project and team of axolodao.org (public identifiers, not secrets): no `vercel link`, which rewrites env files
const PROYECTO = { VERCEL_ORG_ID: 'team_XjfpO7AZSWRvHCNkWyfgkScr', VERCEL_PROJECT_ID: 'prj_VrAsgKyPP51hsyrF60FUMNiARqSp' };

/** What runs, in order: the build, the embargo check on what it built (it fails closed without the key), then Vercel's packaging and upload. */
export const pasos = (vercel, head) => [
  ['npm', ['run', 'build:sitio']],
  ['node', ['scripts/test-embargo.mjs', '--dist']],
  [vercel, ['pull', '--yes', '--environment=production']],
  [vercel, ['build', '--prod'], { BUILD_SITIO_DESPLIEGUE: '1' }],
  [vercel, ['deploy', '--prebuilt', '--prod', '--meta', `gitCommit=${head}`, '--meta', 'gitBranch=main']],
];

/** Why this tree may not go to production, or null: it must be clean, and its HEAD must be origin/main as just fetched. */
export function motivoParaNoDesplegar({ sucio, head, main }) {
  if (sucio.length) return `the tree is not clean (${sucio.length} change(s) or untracked file(s), e.g. ${sucio[0]}): production comes from a commit`;
  if (!/^[0-9a-f]{40}$/.test(head ?? '') || !/^[0-9a-f]{40}$/.test(main ?? '')) return 'HEAD or origin/main could not be read';
  if (head !== main) return `HEAD ${head.slice(0, 7)} is not origin/main ${main.slice(0, 7)}: production is what main says, so merge first, then deploy from main`;
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = (...a) => execFileSync('git', a, { cwd: SITE }).toString().trim();
  const correr = (cmd, args, env = {}) => {
    const r = spawnSync(cmd, args, { cwd: SITE, stdio: 'inherit', env: { ...process.env, ...PROYECTO, ...env } });
    if (r.status !== 0) { console.error(`REFUSED: ${cmd} ${args[0]} exited ${r.status ?? r.signal}`); process.exit(1); }
  };
  git('fetch', '--quiet', 'origin', 'main');
  const head = git('rev-parse', 'HEAD');
  const motivo = motivoParaNoDesplegar({ sucio: arbolSucio(SITE), head, main: git('rev-parse', 'origin/main') });
  if (motivo) { console.error(`REFUSED: ${motivo}`); process.exit(1); }
  const vercel = process.env.VERCEL_BIN ?? 'vercel';
  for (const [cmd, args, env] of pasos(vercel, head)) correr(cmd, args, env);
  console.log(`\ndeployed ${head.slice(0, 7)}. Check: ${vercel} inspect axolodao.org --scope zenbit (the deployment's meta says gitCommit=${head})`);
}
