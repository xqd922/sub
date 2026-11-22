const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8')

function bytesToBinaryString(bytes: Uint8Array): string {
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)))
  }
  return chunks.join('')
}

function binaryStringToBytes(binary: string): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const compact = value.replace(/\s+/g, '')
  const standard = compact.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4)
  return binaryStringToBytes(atob(padded))
}

export function encodeBase64Utf8(value: string): string {
  return bytesToBase64(encoder.encode(value))
}

export function encodeBase64UrlUtf8(value: string): string {
  return bytesToBase64Url(encoder.encode(value))
}

export function decodeBase64Utf8(value: string): string {
  return decoder.decode(base64ToBytes(value))
}
