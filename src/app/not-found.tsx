import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="font-display tracking-[0.3em] text-[var(--gold)]">404</p>
      <h1 className="font-serif mt-3 text-4xl">这条航线不存在</h1>
      <Link href="/" className="mt-8 inline-block rounded-full bg-[var(--gold)] px-6 py-3 text-sm text-[#071018]">
        返回雷达
      </Link>
    </main>
  );
}
