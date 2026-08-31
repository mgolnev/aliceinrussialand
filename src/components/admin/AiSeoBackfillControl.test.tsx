import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiSeoBackfillControl, type AiSeoBackfillSnapshot } from "./AiSeoBackfillControl";

const initial: AiSeoBackfillSnapshot = {
  postsNeedingSeo: 0, imagesNeedingAlt: 7, pending: 7, running: 0, review: 0, failed: 0,
  worker: {
    enabled: true, processing: false, error: null,
    lastCheckedAt: "2026-08-31T10:00:00Z", lastCompletedAt: null, nextCheckAt: null,
  },
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockImplementation(async (_url, options) => Response.json(
    options?.method === "POST" ? { ok: true, status: initial } : initial,
  ));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ручная кнопка всей пачки", () => {
  it("отправляет один запуск всей очереди; опрос статуса не обрабатывает задачи", async () => {
    render(<AiSeoBackfillControl initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Обработать всю очередь" }));
    await screen.findByText(/Запуск всей очереди принят/);
    const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
    expect(posts).toEqual([["/api/admin/seo/backfill?mode=process-all", { method: "POST" }]]);
    expect(screen.getByText(/Последняя успешная проверка/)).toBeInTheDocument();
    expect(screen.getByText(/Ожидают обработки: 7; выполняются: 0/)).toBeInTheDocument();
  });

  it("не отправляет запуск без подтверждения", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    render(<AiSeoBackfillControl initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: "Обработать всю очередь" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
  });

  it("блокирует повторный запуск, пока worker работает", () => {
    const busy = { ...initial, worker: { ...initial.worker, processing: true } };
    fetchMock.mockResolvedValue(Response.json(busy));
    render(<AiSeoBackfillControl initial={busy} />);
    expect(screen.getByRole("button", { name: "Очередь обрабатывается…" })).toBeDisabled();
  });

  it("при выключенном worker не обещает продолжающуюся обработку", async () => {
    const disabled = { ...initial, worker: { ...initial.worker, enabled: false, error: "Не задан CRON_SECRET" } };
    fetchMock.mockResolvedValue(Response.json(disabled));
    render(<AiSeoBackfillControl initial={disabled} />);
    expect(screen.getByRole("button", { name: "Обработать следующую" })).toBeInTheDocument();
    expect(screen.getByText("Не задан CRON_SECRET")).toBeInTheDocument();
    expect(screen.queryByText(/Обработка продолжается на сервере/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("показывает ошибку обновления, сохраняя последний счётчик", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    render(<AiSeoBackfillControl initial={initial} />);
    await screen.findByText(/Не удалось обновить статус/);
    expect(screen.getByText(/Ожидают обработки: 7/)).toBeInTheDocument();
  });

  it("показывает завершение после обновления и не обещает перезапуск FAILED/REVIEW", async () => {
    fetchMock.mockResolvedValue(Response.json({
      ...initial, pending: 0, imagesNeedingAlt: 0, failed: 1, review: 2,
    }));
    render(<AiSeoBackfillControl initial={initial} />);
    await screen.findByText(/У опубликованных материалов уже есть SEO и alt/);
    expect(screen.queryByRole("button", { name: "Обработать всю очередь" })).not.toBeInTheDocument();
    expect(screen.getByText(/Эти задачи не запускаются повторно/)).toBeInTheDocument();
  });
});
