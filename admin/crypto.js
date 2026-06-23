// 비밀번호로 GitHub 토큰을 암호화/복호화 (Web Crypto: PBKDF2 + AES-GCM)
// 암호화된 결과(credentials.json)는 사이트에 커밋되어, 어떤 기기에서든
// 비밀번호만 입력하면 토큰을 풀어 사용할 수 있게 한다.

const ITERATIONS = 200000;

function b64(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function ub64(str) {
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function deriveKey(password, salt, iterations) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(token, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
  return {
    v: 1,
    iterations: ITERATIONS,
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(ct),
  };
}

export async function decryptToken(cred, password) {
  const salt = ub64(cred.salt);
  const iv = ub64(cred.iv);
  const ct = ub64(cred.ciphertext);
  const key = await deriveKey(password, salt, cred.iterations || ITERATIONS);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}
