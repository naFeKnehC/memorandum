import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const fromDir = path.join(root, 'resources', 'icons')
const toDir = path.join(root, 'build')

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
}

function copyIfExists(from, to) {
  try {
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to)
      console.log(`[icons] Copied ${path.relative(root, from)} -> ${path.relative(root, to)}`)
      return true
    }
  } catch (e) {
    console.warn(`[icons] Failed to copy ${from} -> ${to}:`, e?.message || e)
  }
  return false
}

ensureDir(toDir)

// Use system.* as source for package/installer icons across platforms
const srcPng = path.join(fromDir, 'system.png')
const srcIcns = path.join(fromDir, 'system.icns')
const srcIco = path.join(fromDir, 'system.ico')

// electron-builder defaults
const dstPng = path.join(toDir, 'icon.png')
const dstIcns = path.join(toDir, 'icon.icns')
const dstIco = path.join(toDir, 'icon.ico')

let any = false
let pngDone = false

// On macOS, ensure icon.png is at least 512x512 to satisfy electron-builder
if (process.platform === 'darwin' && fs.existsSync(srcPng)) {
  try {
    const out = execSync(`sips -g pixelWidth -g pixelHeight ${JSON.stringify(srcPng)}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    const w = parseInt((/pixelWidth: (\d+)/.exec(out) || [])[1] || '0', 10)
    const h = parseInt((/pixelHeight: (\d+)/.exec(out) || [])[1] || '0', 10)
    if (w < 512 || h < 512) {
      ensureDir(toDir)
      execSync(`sips -z 512 512 ${JSON.stringify(srcPng)} --out ${JSON.stringify(dstPng)}`, { stdio: 'inherit' })
      console.log(`[icons] Upscaled system.png to 512x512 -> build/icon.png`)
      any = true
      pngDone = true
    }
  } catch (e) {
    console.warn('[icons] sips check/resize failed; copying as-is. Error:', e?.message || e)
  }
}

if (!pngDone) any = copyIfExists(srcPng, dstPng) || any
any = copyIfExists(srcIcns, dstIcns) || any
any = copyIfExists(srcIco, dstIco) || any

if (!any) {
  console.warn('[icons] No system.* icons found under resources/icons. Place system.png (and optionally system.icns/system.ico).')
}
