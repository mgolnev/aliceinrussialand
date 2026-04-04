export type SocialPlatform = "instagram" | "behance";

export type SocialImportItem = {
  /** Стабильный ID из внешней сети (если есть). */
  externalId: string;
  href: string;
  text: string;
  imageUrls: string[];
  dateIso: string | null;
};

export type SocialImportPage = {
  items: SocialImportItem[];
  nextCursor: string | null;
};

export type SocialImportProvider = {
  platform: SocialPlatform;
  preview(args: {
    account: string;
    limit: number;
    cursor?: string | null;
  }): Promise<SocialImportPage>;
};
