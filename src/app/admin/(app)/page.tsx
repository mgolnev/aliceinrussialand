import { redirect } from "next/navigation";

/** Вход в /admin ведёт на ленту; список постов — /admin/posts */
export default function AdminIndexPage() {
  redirect("/");
}
