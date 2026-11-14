"use client";

/** Any server error: a calm line for the child, no details (they go to the server log only). */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Cô gia sư đang gặp trục trặc</h1>
      <p>Em thử lại sau ít phút, hoặc quay về Góc học tập nhé.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn bg-accent text-white">Thử lại</button>
        <a href="/today?tab=hoc-tap" className="btn border-[1.5px] border-ink/20 bg-white no-underline">← Về Góc học tập</a>
      </div>
    </main>
  );
}
