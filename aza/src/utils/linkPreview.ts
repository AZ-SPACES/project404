export type LinkPreview = {
  url: string;
  title?: string | undefined;
  description?: string | undefined;
  image?: string | undefined;
  siteName?: string | undefined;
};

export const URL_RE = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/;

export function extractFirstUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m?.[1] ?? null;
}

const cache = new Map<string, LinkPreview | null>();
const inFlight = new Map<string, Promise<LinkPreview | null>>();

function parseMeta(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property.replace('og:', '')}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return undefined;
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (cache.has(url)) return cache.get(url)!;
  if (inFlight.has(url)) return inFlight.get(url)!;

  const promise = (async (): Promise<LinkPreview | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AZA/1.0)' },
      });
      clearTimeout(timeout);
      if (!response.ok) { cache.set(url, null); return null; }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        const result: LinkPreview = { url, siteName: new URL(url).hostname };
        cache.set(url, result);
        return result;
      }
      const html = await response.text();
      const titleTag = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
      const result: LinkPreview = {
        url,
        title: parseMeta(html, 'og:title') ?? (titleTag?.[1]?.trim()),
        description: parseMeta(html, 'og:description'),
        image: parseMeta(html, 'og:image'),
        siteName: parseMeta(html, 'og:site_name') ?? new URL(url).hostname,
      };
      cache.set(url, result);
      return result;
    } catch {
      cache.set(url, null);
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, promise);
  return promise;
}
