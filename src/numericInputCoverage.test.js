import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default
const root = path.resolve('src')
describe('numerical entry coverage', () => {
  it('routes every application JSX input through the shared editor', () => {
    const missing = []
    let covered = 0
    function walk(dir) {
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name)
        if (item.isDirectory()) { walk(file); continue }
        if (!/\.[jt]sx?$/.test(item.name) || /(?:^|\.)test\.[jt]sx?$/.test(item.name) || item.name === 'BrainDrainNumericInput.jsx') continue
        const source = fs.readFileSync(file, 'utf8')
        const ast = parse(source, { sourceType: 'unambiguous', plugins: ['jsx', ...(file.endsWith('.ts') || file.endsWith('.tsx') ? ['typescript'] : [])] })
        traverse(ast, { JSXElement({ node }) {
          if (node.openingElement.name.type !== 'JSXIdentifier') return
          if (node.openingElement.name.name === 'input') missing.push(file)
          if (node.openingElement.name.name === 'BrainDrainNumericInput') covered++
        } })
      }
    }
    walk(root)
    expect(missing).toEqual([])
    expect(covered).toBeGreaterThan(0)
  })
})
