import type { ReactNode } from "react";
import type { SocialKind } from "@/lib/social-link-kinds";
import {
  siBehance,
  siDribbble,
  siFacebook,
  siGithub,
  siInstagram,
  siPinterest,
  siTelegram,
  siThreads,
  siTiktok,
  siVk,
  siX,
  siYoutube,
} from "simple-icons/icons";

type Props = {
  kind: SocialKind;
  size?: number;
  className?: string;
};

function IconBadge({
  size,
  bg,
  className,
  children,
}: {
  size: number;
  bg: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="12" fill={bg} />
      {children}
    </svg>
  );
}

function BrandPathBadge({
  iconPath,
  bg,
  size,
  className,
  scale = 0.72,
}: {
  iconPath: string;
  bg: string;
  size: number;
  className?: string;
  scale?: number;
}) {
  const shift = (24 - 24 * scale) / 2;
  return (
    <IconBadge size={size} bg={bg} className={className}>
      <path
        d={iconPath}
        fill="#FFFFFF"
        transform={`translate(${shift} ${shift}) scale(${scale})`}
      />
    </IconBadge>
  );
}

function StrokeBadge({
  path,
  bg,
  size,
  className,
}: {
  path: string;
  bg: string;
  size: number;
  className?: string;
}) {
  const scale = 0.7;
  const shift = (24 - 24 * scale) / 2;

  return (
    <IconBadge size={size} bg={bg} className={className}>
      <path
        d={path}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${shift} ${shift}) scale(${scale})`}
      />
    </IconBadge>
  );
}

export function SocialBrandIcon({ kind, size = 20, className }: Props) {
  switch (kind) {
    case "email":
      return (
        <StrokeBadge
          path="M3 6h18v12H3z M3 7l9 6 9-6"
          size={size}
          bg="#6B7280"
          className={className}
        />
      );
    case "x":
      return <BrandPathBadge iconPath={siX.path} bg="#111111" size={size} className={className} />;
    case "threads":
      return <BrandPathBadge iconPath={siThreads.path} bg="#111111" size={size} className={className} />;
    case "other":
      return (
        <StrokeBadge
          path="M14 3h7v7 M21 3l-9 9 M19 14v7H3V5h7"
          size={size}
          bg="#6B7280"
          className={className}
        />
      );
    case "instagram":
      return (
        <BrandPathBadge iconPath={siInstagram.path} bg="#E4405F" size={size} className={className} />
      );
    case "telegram":
      return (
        <BrandPathBadge iconPath={siTelegram.path} bg="#229ED9" size={size} className={className} />
      );
    case "youtube":
      return (
        <BrandPathBadge iconPath={siYoutube.path} bg="#FF0000" size={size} className={className} />
      );
    case "pinterest":
      return (
        <BrandPathBadge iconPath={siPinterest.path} bg="#E60023" size={size} className={className} />
      );
    case "vk":
      return (
        <BrandPathBadge iconPath={siVk.path} bg="#0077FF" size={size} className={className} />
      );
    case "facebook":
      return (
        <BrandPathBadge iconPath={siFacebook.path} bg="#1877F2" size={size} className={className} />
      );
    case "linkedin":
      return (
        <IconBadge size={size} bg="#0A66C2" className={className}>
          <path
            d="M6.74 9.07a1.65 1.65 0 1 1 0-3.3 1.65 1.65 0 0 1 0 3.3Zm-1.3 1.08h2.59v8.08H5.44v-8.08Zm4.06 0h2.48v1.1h.04c.35-.65 1.2-1.33 2.46-1.33 2.63 0 3.12 1.73 3.12 3.98v4.33h-2.59v-3.84c0-.91-.02-2.09-1.27-2.09-1.27 0-1.46 1-1.46 2.02v3.91H9.5v-8.08Z"
            fill="#FFFFFF"
          />
        </IconBadge>
      );
    case "behance":
      return (
        <BrandPathBadge iconPath={siBehance.path} bg="#1769FF" size={size} className={className} />
      );
    case "dribbble":
      return (
        <BrandPathBadge iconPath={siDribbble.path} bg="#EA4C89" size={size} className={className} />
      );
    case "tiktok":
      return (
        <BrandPathBadge iconPath={siTiktok.path} bg="#111111" size={size} className={className} />
      );
    case "github":
      return (
        <BrandPathBadge iconPath={siGithub.path} bg="#111111" size={size} className={className} />
      );
  }
}
