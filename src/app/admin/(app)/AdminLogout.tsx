"use client";

export function AdminLogout() {
  return (
    <button
      type="button"
      className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500 shadow-sm hover:text-stone-800"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
    >
      Выйти
    </button>
  );
}
