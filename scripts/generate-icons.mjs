import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

function crc32(buffer) {
  let crc = ~0
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [red, green, blue, alpha] = pixel(x, y, size)
      const index = row + 1 + x * 4
      raw[index] = red
      raw[index + 1] = green
      raw[index + 2] = blue
      raw[index + 3] = alpha
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function dumbbell(x, y, size) {
  const px = (x + 0.5) / size
  const py = (y + 0.5) / size
  const center = 0.5
  const bar = py > 0.455 && py < 0.545 && px > 0.3 && px < 0.7
  const left = (px - 0.32) ** 2 / 0.075 ** 2 + (py - center) ** 2 / 0.16 ** 2 <= 1
  const right = (px - 0.68) ** 2 / 0.075 ** 2 + (py - center) ** 2 / 0.16 ** 2 <= 1
  if (bar || left || right) return [244, 241, 232, 255]
  return [15, 110, 86, 255]
}

const directory = path.resolve('public')
mkdirSync(directory, { recursive: true })
for (const size of [180, 192, 512]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  writeFileSync(path.join(directory, name), png(size, dumbbell))
}
console.log('wrote icons')
