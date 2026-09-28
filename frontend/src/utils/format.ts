const WEI_PER_ETH = 1_000_000_000_000_000_000n;

/**
 * Truncate an Ethereum address to `prefix...suffix` format.
 * @param addr - Full Ethereum address
 * @param prefixLen - Characters to keep at start (default: 6)
 * @param suffixLen - Characters to keep at end (default: 4)
 */
export function shortAddr(addr: string, prefixLen = 6, suffixLen = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, prefixLen)}...${addr.slice(-suffixLen)}`;
}

/**
 * Format a bigint wei value to a human-readable ETH string.
 * Shows up to 4 decimal places, trailing zeros stripped.
 */
export function formatEth(value: bigint): string {
  if (typeof value !== 'bigint') return '0';
  const whole = value / WEI_PER_ETH;
  const fraction = value % WEI_PER_ETH;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${padded.replace(/0+$/, '')}`;
}
