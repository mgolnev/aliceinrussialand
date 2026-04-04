import { socialFetchJson } from "@/lib/social-import/fetch";
import type { SocialImportPage, SocialImportProvider } from "@/lib/social-import/types";

type IgGraphMedia = {
  id?: string;
  permalink?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  timestamp?: string;
};

type IgGraphResponse = {
  data?: IgGraphMedia[];
  paging?: { cursors?: { after?: string } };
};

type IgWebEdgeNode = {
  id?: string;
  shortcode?: string;
  display_url?: string;
  taken_at_timestamp?: number;
  edge_media_to_caption?: {
    edges?: Array<{ node?: { text?: string } }>;
  };
  edge_sidecar_to_children?: {
    edges?: Array<{ node?: { display_url?: string } }>;
  };
};

type IgWebInfoResponse = {
  data?: {
    user?: {
      edge_owner_to_timeline_media?: {
        edges?: Array<{ node?: IgWebEdgeNode }>;
      };
    };
  };
};

type IgLegacyResponse = {
  graphql?: {
    user?: {
      edge_owner_to_timeline_media?: {
        edges?: Array<{ node?: IgWebEdgeNode }>;
      };
    };
  };
};

const IG_PREVIEW_CACHE_TTL_MS = 90_000;
const igPreviewCache = new Map<string, { ts: number; page: SocialImportPage }>();

function isRateOrBlockError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("HTTP 429") || msg.includes("HTTP 403") || msg.includes("HTTP 401");
}

async function withBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 350,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i >= retries) break;
      const jitter = Math.floor(Math.random() * 150);
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1) + jitter));
    }
  }
  throw lastError;
}

function parseCaption(node: IgWebEdgeNode): string {
  return (
    node.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() ||
    ""
  );
}

function mapGraphMedia(m: IgGraphMedia) {
  const href = m.permalink?.trim() || "";
  const imageUrls = m.media_url ? [m.media_url] : [];
  return {
    externalId: m.id || href,
    href,
    text: m.caption?.trim() || "",
    imageUrls,
    dateIso: m.timestamp ?? null,
  };
}

function mapWebNode(node: IgWebEdgeNode) {
  const shortcode = node.shortcode?.trim() || "";
  const href = shortcode ? `https://www.instagram.com/p/${shortcode}/` : "";
  const sidecar =
    node.edge_sidecar_to_children?.edges
      ?.map((e) => e.node?.display_url?.trim() || "")
      .filter(Boolean) ?? [];
  const imageUrls = sidecar.length
    ? sidecar
    : [node.display_url?.trim() || ""].filter(Boolean);
  const dateIso =
    typeof node.taken_at_timestamp === "number" &&
    Number.isFinite(node.taken_at_timestamp)
      ? new Date(node.taken_at_timestamp * 1000).toISOString()
      : null;
  return {
    externalId: node.id || shortcode || href,
    href,
    text: parseCaption(node),
    imageUrls,
    dateIso,
  };
}

async function previewViaGraphApi(
  account: string,
  limit: number,
  cursor?: string | null,
): Promise<SocialImportPage> {
  const token = process.env.INSTAGRAM_GRAPH_API_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_GRAPH_USER_ID?.trim();
  const boundUsername = process.env.INSTAGRAM_GRAPH_USERNAME?.trim().toLowerCase();
  if (!token || !userId) throw new Error("Graph API не настроен");
  if (boundUsername && boundUsername !== account.toLowerCase()) {
    throw new Error("Graph API настроен для другого аккаунта");
  }

  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "permalink",
    "timestamp",
  ].join(",");
  const url =
    `https://graph.facebook.com/v23.0/${encodeURIComponent(userId)}/media` +
    `?fields=${encodeURIComponent(fields)}` +
    `&limit=${Math.min(limit, 24)}` +
    (cursor ? `&after=${encodeURIComponent(cursor)}` : "") +
    `&access_token=${encodeURIComponent(token)}`;
  const json = await socialFetchJson<IgGraphResponse>(url, {
    headers: { Accept: "application/json" },
  });
  const items = (json.data ?? [])
    .map(mapGraphMedia)
    .filter((i) => Boolean(i.href || i.text));
  return {
    items,
    nextCursor: json.paging?.cursors?.after ?? null,
  };
}

async function previewViaWeb(account: string, limit: number): Promise<SocialImportPage> {
  const url =
    `https://www.instagram.com/api/v1/users/web_profile_info/` +
    `?username=${encodeURIComponent(account)}`;
  const json = await socialFetchJson<IgWebInfoResponse>(url, {
    headers: {
      Accept: "application/json",
      "X-IG-App-ID": "936619743392459",
      Referer: `https://www.instagram.com/${encodeURIComponent(account)}/`,
    },
  });
  const edges = json.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  const items = edges
    .slice(0, Math.min(limit, 24))
    .map((e) => mapWebNode(e.node ?? {}))
    .filter((i) => Boolean(i.href || i.text));
  return { items, nextCursor: null };
}

async function previewViaWebAltHost(
  account: string,
  limit: number,
): Promise<SocialImportPage> {
  const url =
    `https://i.instagram.com/api/v1/users/web_profile_info/` +
    `?username=${encodeURIComponent(account)}`;
  const json = await socialFetchJson<IgWebInfoResponse>(url, {
    headers: {
      Accept: "application/json",
      "X-IG-App-ID": "936619743392459",
      "X-ASBD-ID": "129477",
      Referer: `https://www.instagram.com/${encodeURIComponent(account)}/`,
    },
  });
  const edges = json.data?.user?.edge_owner_to_timeline_media?.edges ?? [];
  const items = edges
    .slice(0, Math.min(limit, 24))
    .map((e) => mapWebNode(e.node ?? {}))
    .filter((i) => Boolean(i.href || i.text));
  return { items, nextCursor: null };
}

async function previewViaLegacyA1(
  account: string,
  limit: number,
): Promise<SocialImportPage> {
  const url =
    `https://www.instagram.com/${encodeURIComponent(account)}/` +
    `?__a=1&__d=dis`;
  const json = await socialFetchJson<IgLegacyResponse>(url, {
    headers: {
      Accept: "application/json",
      Referer: `https://www.instagram.com/${encodeURIComponent(account)}/`,
    },
  });
  const edges = json.graphql?.user?.edge_owner_to_timeline_media?.edges ?? [];
  const items = edges
    .slice(0, Math.min(limit, 24))
    .map((e) => mapWebNode(e.node ?? {}))
    .filter((i) => Boolean(i.href || i.text));
  return { items, nextCursor: null };
}

function cacheKey(account: string, limit: number, cursor?: string | null): string {
  return `${account.toLowerCase()}::${limit}::${cursor ?? ""}`;
}

export const instagramProvider: SocialImportProvider = {
  platform: "instagram",
  async preview({ account, limit, cursor }) {
    const key = cacheKey(account, limit, cursor);
    const hit = igPreviewCache.get(key);
    if (hit && Date.now() - hit.ts < IG_PREVIEW_CACHE_TTL_MS) {
      return hit.page;
    }

    try {
      const page = await previewViaGraphApi(account, limit, cursor);
      igPreviewCache.set(key, { ts: Date.now(), page });
      return page;
    } catch (graphError) {
      try {
        const page = await withBackoff(() => previewViaWeb(account, limit));
        igPreviewCache.set(key, { ts: Date.now(), page });
        return page;
      } catch (webError) {
        try {
          const page = await withBackoff(() => previewViaWebAltHost(account, limit));
          igPreviewCache.set(key, { ts: Date.now(), page });
          return page;
        } catch (altError) {
          try {
            const page = await withBackoff(() => previewViaLegacyA1(account, limit), 1);
            igPreviewCache.set(key, { ts: Date.now(), page });
            return page;
          } catch (legacyError) {
            const errors = [graphError, webError, altError, legacyError]
              .map((e) => (e instanceof Error ? e.message : String(e)))
              .join(" | ");
            if ([graphError, webError, altError, legacyError].some(isRateOrBlockError)) {
              throw new Error(`HTTP 429 (fallback failed): ${errors}`);
            }
            throw new Error(`Instagram fallback failed: ${errors}`);
          }
        }
      }
    }
  },
};
