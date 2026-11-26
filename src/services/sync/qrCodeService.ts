import jsQR from 'jsqr';
import { PAIRING_PIN_TTL_MS } from '../../types';

/**
 * ISO/IEC 18004 QR Code SVG generator and decoder service for P2P Device Pairing.
 * Uses hardware W3C BarcodeDetector when available and jsQR pure-JS Canvas decoder as fallback.
 */

export interface QrPairingData {
  app: 'glueck';
  v: number;
  deviceId: string;
  deviceName: string;
  pin: string;
  ts: number;
}

export interface ParseResult {
  valid: boolean;
  error?: string;
  expired?: boolean;
  payload?: {
    deviceId: string;
    deviceName: string;
    pin: string;
    version: number;
    timestamp: number;
  };
}

export function createPairingPayload(
  deviceId: string,
  deviceName: string,
  pin: string,
  version = 2
): string {
  const data: QrPairingData = {
    app: 'glueck',
    v: version,
    deviceId: deviceId.trim(),
    deviceName: deviceName.trim(),
    pin: pin.replace(/\D/g, '').slice(0, 6),
    ts: Date.now()
  };
  return JSON.stringify(data);
}

export function parsePairingPayload(raw: string, maxAgeMs = PAIRING_PIN_TTL_MS): ParseResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Empty or invalid QR code data' };
  }

  const trimmed = raw.trim();

  if (/^\d{6}$/.test(trimmed)) {
    return {
      valid: true,
      payload: {
        deviceId: '',
        deviceName: 'Companion Device',
        pin: trimmed,
        version: 1,
        timestamp: Date.now()
      }
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Malformed pairing metadata' };
    }

    const pin = (parsed.pin || parsed.pairingPin || '').toString().replace(/\D/g, '').slice(0, 6);
    if (!pin || pin.length < 6) {
      return { valid: false, error: 'Missing or invalid 6-digit security PIN in QR code' };
    }

    const deviceId = (parsed.deviceId || parsed.id || '').toString().trim();
    const deviceName = (parsed.deviceName || parsed.name || 'Companion Device').toString().trim();
    const version = Number(parsed.v || parsed.version || 2);
    const timestamp = Number(parsed.ts || parsed.timestamp || Date.now());
    const isExpired = Date.now() - timestamp > maxAgeMs;

    return {
      valid: true,
      expired: isExpired,
      payload: {
        deviceId,
        deviceName,
        pin,
        version,
        timestamp
      }
    };
  } catch {
    if (trimmed.startsWith('glueck://') || trimmed.includes('pin=')) {
      try {
        const urlStr = trimmed.startsWith('glueck://') ? trimmed.replace('glueck://', 'http://glueck/') : trimmed;
        const url = new URL(urlStr);
        const pin = (url.searchParams.get('pin') || '').replace(/\D/g, '').slice(0, 6);
        const deviceId = url.searchParams.get('id') || url.searchParams.get('deviceId') || '';
        const deviceName = url.searchParams.get('name') || 'Companion Device';
        const ts = Number(url.searchParams.get('ts') || Date.now());

        if (/^\d{6}$/.test(pin)) {
          return {
            valid: true,
            expired: Date.now() - ts > maxAgeMs,
            payload: {
              deviceId,
              deviceName,
              pin,
              version: 2,
              timestamp: ts
            }
          };
        }
      } catch {}
    }

    return { valid: false, error: 'Unrecognized QR code format. Please scan an authentic pairing code.' };
  }
}

// --- GF(256) Galois Field Math for Standard ISO 18004 QR Error Correction (ECC Level L) ---
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGeneratorPoly(ecCount: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeRsRemainder(data: number[], ecCount: number): number[] {
  const gen = buildRsGeneratorPoly(ecCount);
  const res = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coeff = res[i];
    if (coeff !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coeff);
      }
    }
  }
  return res.slice(data.length);
}

interface QrVersionSpec {
  version: number;
  dataCodewords: number;
  ecPerBlock: number;
  blocks: number[];
  align: number[];
  remBits: number;
}

// Single-block / multi-block Level-L specs for V4, V6, V8, V10 (exact ISO 18004)
const QR_SPECS: QrVersionSpec[] = [
  { version: 4, dataCodewords: 80, ecPerBlock: 20, blocks: [80], align: [6, 26], remBits: 7 },
  { version: 6, dataCodewords: 136, ecPerBlock: 18, blocks: [68, 68], align: [6, 34], remBits: 7 },
  { version: 8, dataCodewords: 194, ecPerBlock: 24, blocks: [97, 97], align: [6, 24, 42], remBits: 7 },
  { version: 10, dataCodewords: 274, ecPerBlock: 18, blocks: [68, 68, 69, 69], align: [6, 28, 50], remBits: 0 }
];

/**
 * Builds an ISO/IEC 18004 standards-compliant QR code boolean matrix (ECC Level L, Mask 0).
 */
export function createQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const countBitsLen = 8; // versions <= 9 use 8-bit count; V10+ uses 16-bit byte count!
  const spec =
    QR_SPECS.find((s) => {
      const headerBits = 4 + (s.version >= 10 ? 16 : countBitsLen);
      return headerBits + bytes.length * 8 <= s.dataCodewords * 8;
    }) || QR_SPECS[QR_SPECS.length - 1];

  const version = spec.version;
  const size = version * 4 + 17;
  const countBits = version >= 10 ? 16 : 8;

  // Build data bitstream
  const bits: number[] = [0, 1, 0, 0]; // Byte mode 0100
  for (let b = countBits - 1; b >= 0; b--) bits.push((bytes.length >> b) & 1);
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) bits.push((bytes[i] >> b) & 1);
  }
  const maxDataBits = spec.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxDataBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let b = 0; b < 8; b++) val = (val << 1) | bits[i + b];
    dataBytes.push(val);
  }
  let padToggle = 0;
  while (dataBytes.length < spec.dataCodewords) {
    dataBytes.push(padToggle % 2 === 0 ? 0xec : 0x11);
    padToggle++;
  }

  // Split into RS blocks & interleave
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let cursor = 0;
  for (const blkLen of spec.blocks) {
    const blk = dataBytes.slice(cursor, cursor + blkLen);
    cursor += blkLen;
    dataBlocks.push(blk);
    ecBlocks.push(computeRsRemainder(blk, spec.ecPerBlock));
  }

  const finalCodewords: number[] = [];
  const maxDataBlkLen = Math.max(...spec.blocks);
  for (let i = 0; i < maxDataBlkLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) finalCodewords.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const ec of ecBlocks) {
      if (i < ec.length) finalCodewords.push(ec[i]);
    }
  }

  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) finalBits.push((cw >> b) & 1);
  }
  for (let r = 0; r < spec.remBits; r++) finalBits.push(0);

  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunction[nr][nc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            matrix[nr][nc] = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    isFunction[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    isFunction[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  for (const r of spec.align) {
    for (const c of spec.align) {
      if (isFunction[r][c]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          isFunction[r + dr][c + dc] = true;
          matrix[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        }
      }
    }
  }

  // Dark module
  isFunction[4 * version + 9][8] = true;
  matrix[4 * version + 9][8] = true;

  // Format info reserve
  for (let i = 0; i < 9; i++) {
    isFunction[8][i] = true;
    isFunction[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }

  // Version info (V7+)
  if (version >= 7) {
    const versionInfoBits: Record<number, number> = {
      8: 0x085bc,
      10: 0x0a4d3
    };
    const vBits = versionInfoBits[version] || 0;
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      matrix[a][b] = bit;
      isFunction[a][b] = true;
      matrix[b][a] = bit;
      isFunction[b][a] = true;
    }
  }

  // Zigzag placement with Mask 0: (row + col) % 2 === 0
  let bitIdx = 0;
  let dir = -1;
  let row = size - 1;
  let col = size - 1;
  while (col > 0) {
    if (col === 6) col--;
    while (row >= 0 && row < size) {
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!isFunction[row][c]) {
          const bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          const mask = (row + c) % 2 === 0;
          matrix[row][c] = (bit === 1) !== mask;
        }
      }
      row += dir;
    }
    dir = -dir;
    row += dir;
    col -= 2;
  }

  // Format string for ECC Level L (01) + Mask 0 (000) -> 01000 -> BCH+mask(101010000010010) = 111011111000100
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix;
}

export function generateQrSvg(text: string, size = 200): string {
  const matrix = createQrMatrix(text);
  const n = matrix.length;
  const cellSize = size / (n + 8);
  const offset = cellSize * 4;
  let rects = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (offset + c * cellSize).toFixed(2);
        const y = (offset + r * cellSize).toFixed(2);
        const w = (cellSize + 0.05).toFixed(2);
        const h = (cellSize + 0.05).toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0f172a"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#ffffff" rx="12"/>
    ${rects}
  </svg>`;
}

// --- Multi-Platform QR Detection Engine (BarcodeDetector + jsQR fallback) ---

export function hasNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export function canScanQrWithCamera(): boolean {
  if (hasNativeBarcodeDetector()) return true;
  if (typeof document !== 'undefined') return true;
  return false;
}

function isImageDataLike(source: any): source is { data: Uint8ClampedArray; width: number; height: number } {
  return Boolean(
    source &&
      typeof source === 'object' &&
      source.data instanceof Uint8ClampedArray &&
      typeof source.width === 'number' &&
      typeof source.height === 'number'
  );
}

async function extractImageDataForJsQr(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData | Blob | File
): Promise<{ data: Uint8ClampedArray; width: number; height: number } | null> {
  if (isImageDataLike(source)) {
    return source;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    if (!source.width || !source.height) return null;
    const srcCtx = source.getContext('2d', { willReadFrequently: true });
    if (srcCtx) {
      return srcCtx.getImageData(0, 0, source.width, source.height);
    }
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    const w = source.videoWidth;
    const h = source.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  if ((typeof Blob !== 'undefined' && source instanceof Blob) || (typeof File !== 'undefined' && source instanceof File)) {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(source);
      try {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
      } finally {
        bmp.close?.();
      }
    }
  }

  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.drawImage(source, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  return null;
}

export async function scanQrFromSource(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData | Blob | File
): Promise<string | null> {
  if (hasNativeBarcodeDetector()) {
    try {
      const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      let inputSource: any = source;
      if ((typeof Blob !== 'undefined' && source instanceof Blob) || (typeof File !== 'undefined' && source instanceof File)) {
        inputSource = await createImageBitmap(source);
      }
      const barcodes = await barcodeDetector.detect(inputSource);
      if (barcodes && barcodes.length > 0) {
        return barcodes[0].rawValue || barcodes[0].displayValue || null;
      }
    } catch (e) {
      console.warn('[QrScanner] BarcodeDetector notice, falling back to jsQR:', e);
    }
  }

  try {
    const imgData = await extractImageDataForJsQr(source);
    if (!imgData) return null;
    const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'attemptBoth'
    });
    return decoded?.data || null;
  } catch (e) {
    console.warn('[QrScanner] jsQR decode notice:', e);
    return null;
  }
}
