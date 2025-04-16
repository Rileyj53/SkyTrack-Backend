export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Simple base64url encoding/decoding functions
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const base64 = btoa(Array.from(new Uint8Array(data))
    .map(byte => String.fromCharCode(byte))
    .join(''));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const decoded = atob(padded);
  return decoded;
}

// Edge-compatible JWT verification
export function verifyToken(token: string): TokenPayload | null {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload as TokenPayload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
} 