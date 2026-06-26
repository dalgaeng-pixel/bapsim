"use client";

import { useActionState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { loginAdminAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";

export default function AdminLoginPage() {
  const [state, action, isPending] = useActionState(loginAdminAction, undefined);

  useEffect(() => {
    if (state?.error) {
      alert(state.error);
    }
  }, [state]);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 bg-stone-50">
      <section className="mx-auto flex min-h-[calc(100vh-48px)] max-w-sm flex-col justify-center">
        <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
          <Logo />
          <form action={action} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-bold text-stone-700">관리자 PIN 번호</span>
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                required
                className="focus-ring mt-2 w-full rounded-md border border-stone-300 px-3 py-3 text-center text-xl font-black tracking-widest"
                placeholder="****"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 font-black text-white disabled:opacity-50"
            >
              <ShieldCheck size={18} />
              {isPending ? "확인 중..." : "관리자 로그인"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
