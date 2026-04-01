import { ImageResponse } from "next/og";
import { absoluteUrl } from "@/lib/absolute-url";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default async function Icon() {
  const settings = await getSiteSettings();
  const avatarPath = parseAvatarUrl(settings.avatarMediaPath);
  const siteOrigin = resolveSiteOrigin(settings.siteUrl);
  const avatarUrl = avatarPath ? absoluteUrl(siteOrigin, avatarPath) : null;
  const avatarReachable = avatarUrl
    ? await fetch(avatarUrl, { cache: "force-cache" })
        .then((res) => res.ok)
        .catch(() => false)
    : false;

  if (avatarUrl && avatarReachable) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#faf8f5",
          }}
        >
          <img
            src={avatarUrl}
            alt=""
            width={64}
            height={64}
            style={{
              width: "64px",
              height: "64px",
              objectFit: "cover",
              borderRadius: "16px",
            }}
          />
        </div>
      ),
      size,
    );
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
          borderRadius: "16px",
          letterSpacing: "-0.04em",
        }}
      >
        {initials}
      </div>
    ),
    size,
  );
}
