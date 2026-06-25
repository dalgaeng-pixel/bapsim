import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-4xl flex-col justify-center">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
          <Logo />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/admin"
              className="focus-ring rounded-lg border border-stone-200 bg-bapsim-red p-6 text-white"
            >
              <ShieldCheck size={28} />
              <h2 className="mt-4 text-2xl font-black">관리자</h2>
              <p className="mt-2 text-sm font-semibold text-red-50">
                오늘 현황, 중요 변경, 배달표, 월별 집계를 확인합니다.
              </p>
            </Link>
            <Link
              href="/client"
              className="focus-ring rounded-lg border border-stone-200 bg-bapsim-rice p-6 text-stone-950"
            >
              <Building2 size={28} />
              <h2 className="mt-4 text-2xl font-black">거래처 담당자</h2>
              <p className="mt-2 text-sm font-semibold text-stone-600">
                오늘 식수 변경, 식사 거절, 업체 정보 변경 요청을 처리합니다.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
