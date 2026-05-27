import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logoPath = join(__dirname, '../public/logo-source.png.jpeg')
const logoBuffer = readFileSync(logoPath)

const sizes = [
  { size: 192, file: 'public/icons/icon-192x192.png' },
  { size: 512, file: 'public/icons/icon-512x512.png' },
  { size: 180, file: 'public/icons/apple-touch-icon.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
]

for (const { size, file } of sizes) {
  const outPath = join(__dirname, '..', file)
  await sharp(logoBuffer)
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`✓ ${file} (${size}x${size})`)
}

console.log('\n✅ تم إنشاء جميع الأيقونات!')
