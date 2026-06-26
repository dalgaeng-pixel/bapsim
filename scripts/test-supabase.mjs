/**
 * Supabase 연결 테스트 스크립트 (REST API 직접 호출)
 * 실행: npm run test:supabase 또는 node scripts/test-supabase.mjs
 * 
 * Node.js 20에서 supabase-js의 WebSocket 의존성 문제를 우회하기 위해
 * Supabase REST API를 직접 fetch로 호출합니다.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// .env.local 파일에서 환경변수 읽기
function loadEnvLocal() {
  try {
    const envPath = resolve(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    const vars = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return null;
  }
}

const env = loadEnvLocal();

if (!env) {
  console.error("❌ .env.local 파일을 찾을 수 없습니다.");
  process.exit(1);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 비어 있습니다.");
  process.exit(1);
}

console.log(`\n🔗 Supabase URL: ${url}`);
console.log(`🔑 Service Role Key: ${serviceKey.slice(0, 15)}...`);

const tables = [
  "clients",
  "meal_types",
  "default_meal_quantities",
  "daily_meal_orders",
  "order_change_logs",
  "change_requests",
  "holidays",
  "notifications",
  "admin_audit_logs",
  "delivery_order_overrides"
];

console.log("\n📋 테이블 확인 중...\n");

let allOk = true;

for (const table of tables) {
  try {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=*&limit=0`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "count=exact"
        }
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.log(`  ❌ ${table}: ${response.status} ${body}`);
      allOk = false;
    } else {
      const range = response.headers.get("content-range");
      const count = range ? range.split("/")[1] : "?";
      console.log(`  ✅ ${table} (${count}행)`);
    }
  } catch (err) {
    console.log(`  ❌ ${table}: ${err.message}`);
    allOk = false;
  }
}

if (allOk) {
  console.log("\n🎉 모든 테이블이 정상적으로 확인되었습니다!");
  console.log("   앱에서 Supabase 모드로 데이터가 저장/로드됩니다.\n");
} else {
  console.log("\n⚠️  일부 테이블에 문제가 있습니다.");
  console.log("   Supabase SQL Editor에서 docs/supabase-schema.sql을 실행해 주세요.\n");
}
