#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const messagesDirectory = path.resolve(process.cwd(), 'messages')
const files = (await readdir(messagesDirectory))
  .filter((file) => file.endsWith('.json'))
  .sort()

if (!files.includes('en.json')) {
  console.error('Missing messages/en.json: English must remain the source catalog.')
  process.exit(1)
}

async function loadCatalog(file) {
  try {
    return JSON.parse(await readFile(path.join(messagesDirectory, file), 'utf8'))
  } catch (error) {
    console.error(`Could not parse messages/${file}: ${error.message}`)
    process.exitCode = 1
    return null
  }
}

function collectNodes(value) {
  const nodes = new Map()

  function visit(node, key) {
    if (Array.isArray(node)) {
      nodes.set(key, { type: 'array', length: node.length })
      node.forEach((item, index) => visit(item, `${key}[${index}]`))
      return
    }

    if (node !== null && typeof node === 'object') {
      nodes.set(key, { type: 'object' })
      for (const [childKey, childValue] of Object.entries(node)) {
        visit(childValue, key ? `${key}.${childKey}` : childKey)
      }
      return
    }

    nodes.set(key, { type: node === null ? 'null' : typeof node, value: node })
  }

  for (const [key, node] of Object.entries(value)) visit(node, key)
  return nodes
}

// Extract ICU argument names while treating a complete plural/select expression
// as one argument, so literal branch text such as {s} is not mistaken for a key.
function placeholders(message) {
  const found = new Set()

  for (let index = 0; index < message.length; index += 1) {
    if (message[index] !== '{') continue

    let cursor = index + 1
    while (/\s/.test(message[cursor] ?? '')) cursor++

    const match = message.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (!match) continue

    let depth = 1
    let end = cursor + match[0].length
    while (end < message.length && depth > 0) {
      if (message[end] === '{') depth++
      else if (message[end] === '}') depth--
      end++
    }

    if (depth === 0) {
      found.add(match[0])
      index = end - 1
    }
  }

  return [...found].sort()
}

const english = await loadCatalog('en.json')
if (!english) process.exit(1)

const baseline = collectNodes(english)
let failed = false
const localeFiles = files.filter((file) => file !== 'en.json')

for (const file of localeFiles) {
  const catalog = await loadCatalog(file)
  if (!catalog) {
    failed = true
    continue
  }

  const current = collectNodes(catalog)
  const missing = [...baseline.keys()].filter((key) => !current.has(key))
  const extra = [...current.keys()].filter((key) => !baseline.has(key))
  const typeMismatches = [...baseline.keys()].filter(
    (key) => current.has(key) && baseline.get(key).type !== current.get(key).type,
  )
  const arrayLengthMismatches = [...baseline.keys()].filter(
    (key) => baseline.get(key).type === 'array'
      && current.get(key)?.type === 'array'
      && baseline.get(key).length !== current.get(key).length,
  )
  const placeholderMismatches = []

  for (const [key, source] of baseline) {
    const translated = current.get(key)
    if (source.type !== 'string' || translated?.type !== 'string') continue

    const expected = placeholders(source.value)
    const actual = placeholders(translated.value)
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      placeholderMismatches.push(key)
    }
  }

  const issues = missing.length + extra.length + typeMismatches.length
    + arrayLengthMismatches.length + placeholderMismatches.length

  if (issues > 0) {
    failed = true
    console.error(`\n${file}: ${issues} catalog issue(s)`)
    if (missing.length) console.error('  Missing keys:', missing.join(', '))
    if (extra.length) console.error('  Extra keys:', extra.join(', '))
    if (typeMismatches.length) console.error('  Type mismatches:', typeMismatches.join(', '))
    if (arrayLengthMismatches.length) console.error('  Array length mismatches:', arrayLengthMismatches.join(', '))
    if (placeholderMismatches.length) console.error('  ICU placeholder mismatches:', placeholderMismatches.join(', '))
  } else {
    console.log(`✓ ${file}: matches en.json structure and ICU placeholders`)
  }
}

if (failed) {
  console.error('\nTranslation catalog validation failed.')
  process.exit(1)
}

console.log(`\nValidated ${localeFiles.length} locale catalog(s) against en.json.`)
