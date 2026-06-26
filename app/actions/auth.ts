"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAdminAction(prevState: any, formData: FormData) {
  const pin = formData.get("pin") as string;
  const adminPin = process.env.ADMIN_PIN || "6642";

  if (pin !== adminPin) {
    return { error: "PIN 번호가 올바르지 않습니다." };
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_token", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/admin");
}

export async function logoutAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_token");
  redirect("/admin/login");
}
