import { PostRouteScrollToTop } from "@/components/feed/PostRouteScrollToTop";

export default function PostSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PostRouteScrollToTop />
      {children}
    </>
  );
}
