import { ImageResponse } from "next/og";
import sharp from "sharp";
import { absoluteUrl } from "@/lib/absolute-url";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";
export const runtime = "nodejs";

async function toPngDataUrl(bytes: ArrayBuffer): Promise<string> {
  const pngBuffer = await sharp(Buffer.from(bytes))
    .resize(64, 64, { fit: "cover" })
    .png()
    .toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}

export default async function Icon() {
  const settings = await getSiteSettings();
  const avatarPath = parseAvatarUrl(settings.avatarMediaPath);
  const siteOrigin = resolveSiteOrigin(settings.siteUrl);
  const avatarUrl = avatarPath ? absoluteUrl(siteOrigin, avatarPath) : null;

  if (avatarUrl) {
    try {
      const avatarResponse = await fetch(avatarUrl, { cache: "force-cache" });
      if (avatarResponse.ok) {
        const avatarBytes = await avatarResponse.arrayBuffer();
        const avatarPngDataUrl = await toPngDataUrl(avatarBytes);
        return new ImageResponse(
          (
            <div
              style={{
                height: "100%",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
              }}
            >
              <img
                src={avatarPngDataUrl}
                alt=""
                width={64}
                height={64}
                style={{
                  width: "64px",
                  height: "64px",
                  objectFit: "cover",
                  borderRadius: "50%",
                }}
              />
            </div>
          ),
          size,
        );
      }
    } catch {
      // Use fallback icon below when avatar download fails.
    }
  }

  const initials = (settings.displayName || "AR").slice(0, 2).toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c1917",
          color: "#ffffff",
          fontSize: 26,
          fontWeight: 700,
          borderRadius: "50%",
          letterSpacing: "-0.04em",
        }}
      >
        {initials}
      </div>
    ),
    size,
  );
}
