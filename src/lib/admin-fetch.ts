/**
 * Запросы к /api/admin/*: куки сессии (на проде и при SameSite важно явно).
 */
export const adminCredentials: RequestInit = {
  credentials: "include",
};

/** Разбор тела ответа: HTML страницы ошибки Vercel не ломает JSON.parse молча. */
export async function readAdminResponseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      error: `Сервер вернул не JSON (HTTP ${res.status}). Обновите страницу или войдите снова.`,
    };
  }
}
