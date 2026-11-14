import { BACK_TO_LAUNCHER } from "@/lib/copy";

/** Header of every screen. The way back is a plain link: Góc học tập belongs to the Launcher app. */
export function TopBar({ back = BACK_TO_LAUNCHER }: { back?: { href: string; label: string } }) {
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-4">
      <a href={back.href} className="btn -ml-3 text-accent no-underline">
        {back.label}
      </a>
      <span className="text-sm font-semibold text-ink/60">Cô gia sư Toán</span>
    </header>
  );
}

export const PARENT_BACK = { href: "/parent", label: "← Về trang bố mẹ" } as const;
