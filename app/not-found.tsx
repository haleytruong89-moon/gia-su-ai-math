import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Không tìm thấy bài này</h1>
      <Link href="/" className="btn self-start bg-accent text-white no-underline">Hỏi bài khác</Link>
    </main>
  );
}
