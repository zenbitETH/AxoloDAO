// Vercel's build command (vercel.json). axolodao.org is deployed as a PREBUILT upload of `npm run build:sitio` on the operator's machine (a strict
// hub read, the attested fingerprint served file by file, a build record from a clean tree), and a prebuilt upload never runs this command.
// A build that Vercel starts by itself (a git push, while the project is connected to the repository) would ship a site without the hub and
// without the fingerprint, so this refuses it. BUILD_SITIO_DESPLIEGUE=1, which only scripts/build-sitio.mjs sets, lets it through with nothing
// to build.   node scripts/build-vercel.mjs
if (process.env.BUILD_SITIO_DESPLIEGUE !== '1') {
  console.error('REFUSED: axolodao.org is deployed only as a prebuilt upload of `npm run build:sitio` (strict hub read and fingerprint); this build was not started by it.');
  process.exit(1);
}
console.log('build:sitio already built the site; nothing to build here.');
