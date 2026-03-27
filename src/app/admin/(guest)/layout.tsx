export default function AdminGuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fffdf8_0%,#f6f0e8_100%)] px-4">
      {children}
    </div>
  );
}
