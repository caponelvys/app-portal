// Minimal store-only (uncompressed) ZIP writer for a single executable file, with
// no dependencies. HTTP downloads can't carry a Unix exec bit, but a zip entry's
// external attributes can — so shipping the macOS `.command` installer inside a
// zip lets it stay executable (double-clickable) after the browser unzips it.

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Build a .zip (Buffer) containing one file marked mode 0755 (rwxr-xr-x). */
export function zipSingleExecutable(filename: string, content: string): Buffer {
  const name = Buffer.from(filename, 'utf8')
  const data = Buffer.from(content, 'utf8')
  const crc = crc32(data)
  const size = data.length
  const dosDate = 0x0021 // 1980-01-01 (0 date trips some extractors)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0) // local file header signature
  local.writeUInt16LE(20, 4)         // version needed to extract
  local.writeUInt16LE(0, 6)          // general purpose flags
  local.writeUInt16LE(0, 8)          // compression method: store
  local.writeUInt16LE(0, 10)         // mod time
  local.writeUInt16LE(dosDate, 12)   // mod date
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(size, 18)      // compressed size
  local.writeUInt32LE(size, 22)      // uncompressed size
  local.writeUInt16LE(name.length, 26)
  local.writeUInt16LE(0, 28)         // extra field length
  const localHeader = Buffer.concat([local, name, data])

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)              // central dir signature
  central.writeUInt16LE(0x031e, 4)                  // version made by: Unix (3) << 8 | 30
  central.writeUInt16LE(20, 6)                      // version needed
  central.writeUInt16LE(0, 8)                       // flags
  central.writeUInt16LE(0, 10)                      // compression: store
  central.writeUInt16LE(0, 12)                      // mod time
  central.writeUInt16LE(dosDate, 14)                // mod date
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(size, 20)
  central.writeUInt32LE(size, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt16LE(0, 30)                      // extra
  central.writeUInt16LE(0, 32)                      // comment
  central.writeUInt16LE(0, 34)                      // disk number start
  central.writeUInt16LE(0, 36)                      // internal attrs
  central.writeUInt32LE((0o100755 << 16) >>> 0, 38) // external attrs: Unix mode 0755
  central.writeUInt32LE(0, 42)                      // local header offset
  const centralHeader = Buffer.concat([central, name])

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)                 // end of central dir signature
  eocd.writeUInt16LE(0, 4)                          // disk number
  eocd.writeUInt16LE(0, 6)                          // disk with central dir
  eocd.writeUInt16LE(1, 8)                          // entries on this disk
  eocd.writeUInt16LE(1, 10)                         // total entries
  eocd.writeUInt32LE(centralHeader.length, 12)      // central dir size
  eocd.writeUInt32LE(localHeader.length, 16)        // central dir offset
  eocd.writeUInt16LE(0, 20)                         // comment length

  return Buffer.concat([localHeader, centralHeader, eocd])
}
