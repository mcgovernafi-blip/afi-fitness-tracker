import { existsSync, readFileSync, readdirSync } from 'node:fs'

const base = '/afi-fitness-tracker/'
const html = readFileSync('dist/index.html', 'utf8')
const register = readFileSync('dist/registerSW.js', 'utf8')
const manifest = readFileSync('dist/manifest.webmanifest', 'utf8')
const parsed = JSON.parse(manifest)
const asset = readdirSync('dist/assets').find((name) => name.endsWith('.js'))

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!html.includes(base)) fail('index.html is missing the Pages base path')
if (!existsSync('dist/404.html')) fail('dist/404.html was not created')
if (!existsSync('dist/sw.js')) fail('service worker was not emitted')
if (!register.includes(`${base}sw.js`) || !register.includes(`scope: '${base}'`)) {
  fail('service worker is not scoped to the Pages subpath')
}
if (parsed.start_url !== '.' && parsed.start_url !== base) {
  fail(`unexpected start_url ${parsed.start_url}`)
}
if (parsed.scope !== '.' && parsed.scope !== base) fail(`unexpected scope ${parsed.scope}`)
if (!asset) fail('built JavaScript is missing')
const source = readFileSync(`dist/assets/${asset}`, 'utf8')
if (!source.includes(base)) fail('router bundle is missing the Pages base path')
console.log('pages build ok')
