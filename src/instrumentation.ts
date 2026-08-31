export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAiSeoWorker } = await import("./lib/ai-seo-worker");
    startAiSeoWorker();
  }
}
