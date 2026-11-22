// Fails when client code breaks the architecture rules. Run by `npm run lint` in client/ and by CI.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const clientSrc = join(import.meta.dirname, '..', 'client', 'src')
const theme = 'index.css'
const apiModule = join('lib', 'api.ts')

const rules = [
  { name: 'raw hex colour outside the theme', pattern: /#[0-9a-fA-F]{3,8}\b/, skip: (f) => f === theme },
  // shadcn primitives set CSS variables (not colours) through style; they are generated code.
  { name: 'inline style outside the theme', pattern: /\bstyle=\{\{/, skip: (f) => f.startsWith(`components${sep}ui${sep}`) },
  { name: 'Fake Store host in client', pattern: /fakestoreapi/i, skip: () => false },
  { name: 'import from server/', pattern: /from\s+['"][^'"]*\bserver\//, skip: () => false },
  { name: 'raw fetch( outside lib/api.ts', pattern: /\bfetch\(/, skip: (f) => f === apiModule },
]

const isTest = (f) => f.startsWith(`test${sep}`) || /\.test\.tsx?$/.test(f)

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* sourceFiles(path)
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path
  }
}

const violations = []
for (const path of sourceFiles(clientSrc)) {
  const file = relative(clientSrc, path)
  if (isTest(file)) continue
  readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
    for (const rule of rules) {
      if (!rule.skip(file) && rule.pattern.test(line)) violations.push(`${file}:${i + 1}: ${rule.name}`)
    }
  })
}

if (violations.length) {
  console.error(`Boundary check failed:\n${violations.join('\n')}`)
  process.exit(1)
}
console.info('Boundary check passed')
