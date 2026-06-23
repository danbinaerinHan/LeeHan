// GitHub REST API 클라이언트 — 브라우저에서 직접 커밋
// 읽기: Contents/Git API, 쓰기: Git Data API(blob→tree→commit→ref) 단일 원자적 커밋

export const CONFIG = {
  owner: 'danbinaerinHan',
  repo: 'LeeHan',
  // 저장 대상 브랜치. 안전한 테스트는 'cms-test'로 바꾼 뒤 확인하고 'main'으로 되돌린다.
  branch: 'main',
  apiBase: 'https://api.github.com',
  siteOrigin: 'https://spaceleehan.kr',
};

const TOKEN_KEY = 'leehan_gh_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function api(path, { method = 'GET', body, token = getToken() } = {}) {
  const url = path.startsWith('http') ? path : `${CONFIG.apiBase}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { /* ignore */ }
    const err = new Error(`GitHub API ${res.status}: ${detail || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

const repoPath = (suffix) => `/repos/${CONFIG.owner}/${CONFIG.repo}${suffix}`;

// 토큰 검증 — 200 + push 권한이면 사용 가능
export async function validateToken(token) {
  const repo = await api(repoPath(''), { token });
  const ok = repo && repo.permissions && repo.permissions.push === true;
  let user = null;
  try { user = await api('/user', { token }); } catch { /* metadata-only token */ }
  return { ok, login: user && user.login, repoFullName: repo && repo.full_name };
}

// 텍스트(UTF-8) 파일 1개를 가져와 내용+sha 반환 (없으면 null)
export async function getFile(path) {
  try {
    const data = await api(repoPath(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${CONFIG.branch}`));
    const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
    return { content, sha: data.sha };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

// ── Git Data API: 단일 원자적 커밋 ──

async function getHead() {
  const ref = await api(repoPath(`/git/ref/heads/${CONFIG.branch}`));
  const headSha = ref.object.sha;
  const commit = await api(repoPath(`/git/commits/${headSha}`));
  return { headSha, baseTree: commit.tree.sha };
}

async function blobUtf8(text) {
  const res = await api(repoPath('/git/blobs'), { method: 'POST', body: { content: text, encoding: 'utf-8' } });
  return res.sha;
}

async function blobBase64(base64) {
  const res = await api(repoPath('/git/blobs'), { method: 'POST', body: { content: base64, encoding: 'base64' } });
  return res.sha;
}

/**
 * 여러 파일을 한 커밋으로 저장.
 * files: [{ path, text }] 또는 [{ path, base64 }]
 */
export async function commitFiles(message, files) {
  const { headSha, baseTree } = await getHead();

  const tree = [];
  for (const f of files) {
    const sha = f.base64 != null ? await blobBase64(f.base64) : await blobUtf8(f.text);
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha });
  }

  const newTree = await api(repoPath('/git/trees'), { method: 'POST', body: { base_tree: baseTree, tree } });
  const newCommit = await api(repoPath('/git/commits'), {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [headSha] },
  });

  try {
    await api(repoPath(`/git/refs/heads/${CONFIG.branch}`), { method: 'PATCH', body: { sha: newCommit.sha } });
  } catch (e) {
    // 누군가 그 사이 push 했다면 한 번 재시도(베이스 갱신)
    if (e.status === 422) {
      const retry = await getHead();
      const t2 = await api(repoPath('/git/trees'), { method: 'POST', body: { base_tree: retry.baseTree, tree } });
      const c2 = await api(repoPath('/git/commits'), { method: 'POST', body: { message, tree: t2.sha, parents: [retry.headSha] } });
      await api(repoPath(`/git/refs/heads/${CONFIG.branch}`), { method: 'PATCH', body: { sha: c2.sha } });
      return c2.sha;
    }
    throw e;
  }
  return newCommit.sha;
}
