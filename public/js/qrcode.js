// Zero-dependency ISO/IEC 18004 QR Code Generator (Byte Mode, ECC Level L, Versions 1-6)

const VERSION_SPECS = [
  null,
  { version: 1, size: 21, dataCodewords: 19, ecPerBlock: 7, blocks: 1, align: [] },
  { version: 2, size: 25, dataCodewords: 34, ecPerBlock: 10, blocks: 1, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecPerBlock: 15, blocks: 1, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecPerBlock: 20, blocks: 1, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecPerBlock: 26, blocks: 1, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecPerBlock: 18, blocks: 2, align: [6, 34] },
];

// Precompute GF(256) log/exp tables with primitive polynomial 0x11d
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

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

export function rsComputeRemainder(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecCount - 1; j++) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return rem;
}

export function computeFormatBits(maskPattern) {
  // ECC Level L = 01 (2 bits) + maskPattern (3 bits)
  const data = (0b01 << 3) | (maskPattern & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function encodeBytes(text) {
  return new TextEncoder().encode(String(text || ''));
}

function chooseSpec(byteLen) {
  for (let v = 1; v < VERSION_SPECS.length; v++) {
    const spec = VERSION_SPECS[v];
    // 4-bit mode + 8-bit length + 8*byteLen bits <= dataCodewords * 8
    const capacityBytes = spec.dataCodewords - 2;
    if (byteLen <= capacityBytes) return spec;
  }
  return VERSION_SPECS[VERSION_SPECS.length - 1];
}

function buildCodewords(bytes, spec) {
  const maxBytes = spec.dataCodewords - 2;
  const payload = bytes.slice(0, maxBytes);
  const bits = [];

  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Byte mode indicator (0100) + 8-bit character count
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  const totalDataBits = spec.dataCodewords * 8;
  // Terminator up to 4 zero bits
  const termLen = Math.min(4, totalDataBits - bits.length);
  pushBits(0, termLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let b = 0; b < 8; b++) val = (val << 1) | bits[i + b];
    dataBytes.push(val);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < spec.dataCodewords) {
    dataBytes.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Split into RS blocks & interleave
  const blockSize = spec.dataCodewords / spec.blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  for (let b = 0; b < spec.blocks; b++) {
    const chunk = dataBytes.slice(b * blockSize, (b + 1) * blockSize);
    dataBlocks.push(chunk);
    ecBlocks.push(rsComputeRemainder(chunk, spec.ecPerBlock));
  }

  const result = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < spec.blocks; b++) result.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) result.push(ecBlocks[b][i]);
  }
  return result;
}

function createMatrix(size) {
  return Array.from({ length: size }, () => new Uint8Array(size));
}

function placeFunctionPatterns(spec) {
  const { size, version, align } = spec;
  const modules = createMatrix(size);
  const isFunc = createMatrix(size);

  const setFunc = (r, c, dark) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark ? 1 : 0;
    isFunc[r][c] = 1;
  };

  const drawFinder = (top, left) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunc(r, c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunc(6, i, dark);
    setFunc(i, 6, dark);
  }

  // Alignment patterns
  for (const ar of align) {
    for (const ac of align) {
      if (isFunc[ar][ac]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(ar + dr, ac + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }
  for (let i = size - 8; i < size; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }

  // Always dark module
  setFunc(4 * version + 9, 8, true);

  return { modules, isFunc };
}

function placeDataBits(modules, isFunc, codewords) {
  const size = modules.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = (((size - 1 - right) >> 1) & 1) === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (isFunc[r][c]) continue;
        let bit = 0;
        if (bitIndex < totalBits) {
          bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        modules[r][c] = bit;
      }
    }
  }
}

function maskCondition(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function drawFormatInfo(grid, mask) {
  const size = grid.length;
  const bits = computeFormatBits(mask);

  const bitAt = (i) => (bits >> i) & 1;

  // Copy 1 around top-left finder
  const coords1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = coords1[i];
    grid[r][c] = bitAt(14 - i);
  }

  // Copy 2 along bottom-left and top-right
  for (let i = 0; i < 7; i++) {
    grid[size - 1 - i][8] = bitAt(14 - i);
  }
  for (let i = 0; i < 8; i++) {
    grid[8][size - 8 + i] = bitAt(7 - i);
  }
}

function computePenalty(grid) {
  const n = grid.length;
  let penalty = 0;

  // Rule 1: runs of 5+ same color
  for (let r = 0; r < n; r++) {
    let runH = 1;
    let runV = 1;
    for (let c = 1; c < n; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runH++;
        if (runH === 5) penalty += 3;
        else if (runH > 5) penalty += 1;
      } else {
        runH = 1;
      }
      if (grid[c][r] === grid[c - 1][r]) {
        runV++;
        if (runV === 5) penalty += 3;
        else if (runV > 5) penalty += 1;
      } else {
        runV = 1;
      }
    }
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = grid[r][c];
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 4: dark/light balance
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) dark += grid[r][c];
  }
  const pct = (dark * 100) / (n * n);
  penalty += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return penalty;
}

export function generateQRMatrix(text) {
  const bytes = encodeBytes(text);
  const spec = chooseSpec(bytes.length);
  const codewords = buildCodewords(bytes, spec);
  const { modules, isFunc } = placeFunctionPatterns(spec);
  placeDataBits(modules, isFunc, codewords);

  let bestGrid = null;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map((row) => new Uint8Array(row));
    for (let r = 0; r < spec.size; r++) {
      for (let c = 0; c < spec.size; c++) {
        if (!isFunc[r][c] && maskCondition(mask, r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    drawFormatInfo(candidate, mask);
    const p = computePenalty(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestGrid = candidate;
    }
  }

  return bestGrid;
}

export function renderQRSvg(text, { size = 180, fg = '#0F172A', bg = '#FFFFFF', margin = 2 } = {}) {
  const matrix = generateQRMatrix(text);
  const n = matrix.length;
  const viewSize = n + margin * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        path += `M${c + margin},${r + margin}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="${viewSize}" height="${viewSize}" fill="${bg}" rx="1.5"/><path d="${path}" fill="${fg}"/></svg>`;
}
