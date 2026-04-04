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

export const instagramProvider: SocialImportProvider = {
  platform: "instagram",
  async preview({ account, limit, cursor }) {
    try {
      return await previewViaGraphApi(account, limit, cursor);
    } catch {
      return await previewViaWeb(account, limit);
    }
  },
};
