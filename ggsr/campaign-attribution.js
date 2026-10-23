const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const storageKey = 'ggsr-bf-attribution';

export function captureAttribution(search, storage) {
  const params = [...new URLSearchParams(search)].map(([key, value]) => [
    key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), value.trim()
  ]);
  const current = Object.fromEntries(keys.map(key => {
    const match = params.find(([name, value]) => name === key && value)
      || params.find(([name, value]) => name.endsWith(`_${key}`) && value)
      || (key === 'utm_source' ? params.find(([name, value]) => name === 'src' && value) : null);
    return [key, match ? match[1] : ''];
  }));

  if (Object.values(current).some(Boolean)) {
    // Uma nova campanha substitui a anterior, sem misturar parâmetros antigos.
    try { storage?.setItem(storageKey, JSON.stringify(current)); } catch {}
    return current;
  }
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || '{}');
    return Object.fromEntries(keys.map(key => [key, typeof saved?.[key] === 'string' ? saved[key] : '']));
  } catch {
    return current;
  }
}

export function attributionUrl(url, attribution) {
  const destination = new URL(url);
  for (const key of keys) {
    if (attribution[key]) destination.searchParams.set(key, attribution[key]);
  }
  return destination.toString();
}
