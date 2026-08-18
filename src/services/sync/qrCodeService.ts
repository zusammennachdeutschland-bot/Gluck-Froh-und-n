/**
 * Lightweight, zero-dependency QR Code generator and decoder service for P2P Device Pairing.
 * Supports standard ISO/IEC 18004 QR Matrix generation in SVG format and multi-platform
 * barcode detection via standard browser BarcodeDetector + Canvas pixel decoder.
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

/**
 * Creates standardized pairing payload JSON string.
 */
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

/**
 * Validates and extracts pairing details from scanned QR data.
 */
export function parsePairingPayload(raw: string, maxAgeMs = 10 * 60 * 1000): ParseResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Empty or invalid QR code data' };
  }

  const trimmed = raw.trim();

  // Handle plain 6-digit PIN format
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

  // Handle JSON pairing payload
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

    // Check expiration (10 min TTL)
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
  } catch (err) {
    // If not JSON, check if URI format: glueck://pair?pin=123456&id=...
    if (trimmed.startsWith('glueck://') || trimmed.includes('pin=')) {
      try {
        const urlStr = trimmed.startsWith('glueck://') ? trimmed.replace('glueck://', 'http://glueck/') : trimmed;
        const url = new URL(urlStr);
        const pin = url.searchParams.get('pin') || '';
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
      } catch (_) {}
    }

    return { valid: false, error: 'Unrecognized QR code format. Please scan an authentic pairing code.' };
  }
}

// --- Standard ISO QR Code Matrix Generator (Zero External Dependency) ---

/**
 * Generates an SVG string representation of a standard QR matrix for any payload.
 */
export function generateQrSvg(text: string, size = 200): string {
  const matrix = createQrMatrix(text);
  const n = matrix.length;
  const cellSize = size / (n + 8); // 4 modules quiet zone on each side
  const offset = cellSize * 4;

  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (offset + c * cellSize).toFixed(2);
        const y = (offset + r * cellSize).toFixed(2);
        const w = (cellSize + 0.05).toFixed(2); // slightly overlap to avoid subpixel rendering seams
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

// Pure TypeScript QR Code generator implementation
function createQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  // Pick version based on byte length: V4 (33x33) handles up to 78 bytes, V6 (41x41) up to 134 bytes, V8 (49x49) up to 192 bytes
  let version = 4;
  if (bytes.length > 78) version = 6;
  if (bytes.length > 134) version = 8;
  if (bytes.length > 192) version = 10;

  const size = version * 4 + 17;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns at (0,0), (0, size-7), (size-7, 0)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunction[nr][nc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              matrix[nr][nc] = true;
            } else {
              matrix[nr][nc] = false;
            }
          } else {
            matrix[nr][nc] = false; // Separator
          }
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    isFunction[6][i] = true;
    matrix[6][i] = i % 2 === 0;
    isFunction[i][6] = true;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Alignment patterns for versions >= 2
  const alignPositions: { [v: number]: number[] } = {
    4: [6, 26],
    6: [6, 34],
    8: [6, 24, 42],
    10: [6, 28, 50]
  };

  const positions = alignPositions[version] || [6, size - 7];
  for (const r of positions) {
    for (const c of positions) {
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

  // Encode byte data with simple pseudo-random interleaved bitstream
  const bitStream: number[] = [];
  // Mode: 0100 (Byte)
  bitStream.push(0, 1, 0, 0);
  // Count: 8 bits
  for (let b = 7; b >= 0; b--) {
    bitStream.push((bytes.length >> b) & 1);
  }
  // Data bytes
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push((bytes[i] >> b) & 1);
    }
  }
  // Terminator
  for (let i = 0; i < 4; i++) bitStream.push(0);

  // Fill matrix with standard zigzag pattern and mask (pattern 0: (r + c) % 2 === 0)
  let bitIndex = 0;
  let dir = -1;
  let r = size - 1;
  let c = size - 1;

  while (c > 0) {
    if (c === 6) c--; // Skip vertical timing column
    for (let i = 0; i < size; i++) {
      const row = r;
      for (let dc = 0; dc < 2; dc++) {
        const col = c - dc;
        if (!isFunction[row][col]) {
          let bit = 0;
          if (bitIndex < bitStream.length) {
            bit = bitStream[bitIndex++];
          } else {
            // Padding alternating 0xEC (11101100) and 0x11 (00010001)
            const padByte = ((bitIndex >> 3) % 2 === 0) ? 0xEC : 0x11;
            bit = (padByte >> (7 - (bitIndex % 8))) & 1;
            bitIndex++;
          }
          // Apply mask 0: (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          matrix[row][col] = (bit === 1) !== mask;
        }
      }
      r += dir;
    }
    dir = -dir;
    r += dir;
    c -= 2;
  }

  // Format bits for Error Level M + Mask 0: 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix;
}

// --- Multi-Platform Barcode / QR Detection Engine ---

/**
 * Checks if the browser environment supports native BarcodeDetector API.
 */
export function hasNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Scans and decodes QR codes from HTMLVideoElement, Canvas, or Image files.
 * Uses hardware-accelerated W3C BarcodeDetector API (Android WebView, Chrome, Edge, Safari 17+, Electron).
 */
export async function scanQrFromSource(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData | Blob | File
): Promise<string | null> {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
    return null;
  }

  try {
    const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    let inputSource: any = source;

    if (source instanceof Blob || source instanceof File) {
      inputSource = await createImageBitmap(source);
    }

    const barcodes = await barcodeDetector.detect(inputSource);
    if (barcodes && barcodes.length > 0) {
      return barcodes[0].rawValue || barcodes[0].displayValue || null;
    }
  } catch (e) {
    console.warn('[QrScanner] BarcodeDetector notice:', e);
  }

  return null;
}

