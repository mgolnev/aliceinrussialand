import { WebmasterPanel } from "@/components/admin/WebmasterPanel";

export const dynamic = "force-dynamic";

export default function AdminWebmasterPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6">
        <h1 className="text-3xl font-semibold tracking-tight">Индексация</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Какие страницы известны Яндексу, какие участвуют в поиске и что стоит
          отправить на переобход сегодня. Новые изменения отдельно передаются
          через IndexNow.
        </p>
      </div>
      <WebmasterPanel />
    </div>
  );
}
