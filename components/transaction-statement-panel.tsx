"use client";

import { Download, Printer, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildTransactionStatementRows, downloadExcel } from "@/lib/export";
import { todayKey } from "@/lib/date";
import { getTransactionStatement, type TransactionStatement } from "@/lib/transaction-statement";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import type { SupplierProfile } from "@/lib/types";

function formatWon(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}년 ${Number(value)}월`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}

function printTransactionStatement(statement: TransactionStatement, supplier: SupplierProfile) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0";
  document.body.appendChild(frame);
  const target = frame.contentWindow;
  const documentRef = target?.document;
  if (!target || !documentRef) {
    frame.remove();
    window.alert("인쇄 창을 열 수 없습니다.");
    return;
  }

  const entries = statement.days.flatMap((day) => {
    const rows: Array<{ date: string; item: string; quantity: number; amount: number }> = [];
    if (day.lunchQuantity > 0) rows.push({ date: day.date, item: "중식", quantity: day.lunchQuantity, amount: day.lunchAmount });
    if (day.dinnerQuantity > 0) rows.push({ date: day.date, item: "석식", quantity: day.dinnerQuantity, amount: day.dinnerAmount });
    return rows;
  });
  const rows: Array<{ date: string; item: string; quantity: number; amount: number } | null> = [
    ...entries,
    ...Array.from({ length: Math.max(0, 24 - entries.length) }, () => null)
  ];
  const accountText = [supplier.bankName, supplier.bankAccountNumber].filter(Boolean).join(" ");
  const rowHeight = entries.length > 45 ? "3.4mm" : entries.length > 32 ? "4mm" : "4.8mm";
  const rowHtml = rows.map((row) => row ? [
    "<tr><td>", escapeHtml(row.date), "</td><td>", escapeHtml(row.item), "</td><td>식</td><td>", String(row.quantity),
    "</td><td>", formatWon(statement.unitPrice), "</td><td>", formatWon(row.amount), "</td><td>&nbsp;</td></tr>"
  ].join("") : "<tr class=\"blank\"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>").join("");

  documentRef.open();
  documentRef.write([
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>거래명세서</title><style>",
    ":root{--row-height:", rowHeight, ";}*{box-sizing:border-box}@page{size:A4 portrait;margin:7mm}",
    "body{margin:0;color:#111;font-family:Arial,\"Malgun Gothic\",sans-serif;font-size:9px}.sheet{width:196mm;min-height:283mm;margin:0 auto}",
    ".title{height:9mm;border:1px solid #111;border-bottom:0;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800}.title small{margin-left:2mm;font-size:9px}",
    ".head{display:grid;grid-template-columns:42% 58%;border:1px solid #111}.recipient{border-right:1px solid #111}.head-title{height:7mm;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #111;font-size:11px;font-weight:800}",
    ".field{display:grid;grid-template-columns:25mm 1fr;min-height:6.4mm;border-bottom:1px solid #111}.field:last-child{border-bottom:0}.field b{display:flex;align-items:center;justify-content:center;border-right:1px solid #111;background:#f8f8f8}.field span{display:flex;align-items:center;padding:1mm 2mm;overflow-wrap:anywhere}",
    ".supplier{display:grid;grid-template-columns:1fr 1fr}.supplier .field:nth-child(odd){border-right:1px solid #111}.supplier .wide{grid-column:span 2}.supplier .field:nth-last-child(-n+2){border-bottom:0}",
    ".total{height:7mm;display:flex;align-items:center;border:1px solid #111;border-top:0;padding:0 2mm;font-weight:800}.total strong{margin-left:4mm;font-size:11px}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{height:var(--row-height);border:1px solid #111;padding:.5mm 1mm;text-align:center;vertical-align:middle;white-space:nowrap}th{height:6mm;background:#f5f5f5;font-weight:800}td:nth-child(4),td:nth-child(5),td:nth-child(6){text-align:right}.blank td{color:transparent}",
    ".summary{border-top:0}.summary td{height:7mm;font-size:10px;font-weight:800}.summary td:last-child{text-align:right;font-size:11px}.account{min-height:8mm;border:1px solid #111;border-top:0;display:flex;align-items:center;justify-content:center;padding:1mm 3mm;font-weight:800}.note{margin:2mm 0 0;color:#444;font-size:8px}",
    "</style></head><body><main class=\"sheet\"><div class=\"title\">거래명세서 <small>(거래명세표)</small></div>",
    "<section class=\"head\"><div class=\"recipient\"><div class=\"head-title\">공급받는자</div>",
    "<div class=\"field\"><b>거래 기간</b><span>", escapeHtml(monthLabel(statement.month)), "</span></div>",
    "<div class=\"field\"><b>상호</b><span>", escapeHtml(statement.account.name), "</span></div>",
    "<div class=\"field\"><b>주소</b><span>", escapeHtml(statement.account.billingAddress || "미입력"), "</span></div></div>",
    "<div><div class=\"head-title\">공급자</div><div class=\"supplier\">",
    "<div class=\"field\"><b>사업자등록번호</b><span>", escapeHtml(supplier.businessRegistrationNumber || "미입력"), "</span></div>",
    "<div class=\"field\"><b>상호</b><span>", escapeHtml(supplier.businessName || "밥심"), "</span></div>",
    "<div class=\"field wide\"><b>사업장 주소</b><span>", escapeHtml(supplier.address || "미입력"), "</span></div>",
    "<div class=\"field\"><b>전화번호</b><span>", escapeHtml(supplier.phone || "미입력"), "</span></div>",
    "<div class=\"field\"><b>이메일</b><span>", escapeHtml(supplier.email || "미입력"), "</span></div>",
    "</div></div></section><div class=\"total\">합계금액:<strong>", formatWon(statement.totalAmount), "</strong>&nbsp;&nbsp;(VAT 포함)</div>",
    "<table><colgroup><col style=\"width:14%\"><col style=\"width:12%\"><col style=\"width:8%\"><col style=\"width:11%\"><col style=\"width:16%\"><col style=\"width:17%\"><col style=\"width:22%\"></colgroup>",
    "<thead><tr><th>일자</th><th>품목</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th><th>비고</th></tr></thead><tbody>", rowHtml, "</tbody></table>",
    "<table class=\"summary\"><tbody><tr><td>중식 합계</td><td>", String(statement.lunchQuantity), "식</td><td>", formatWon(statement.lunchAmount), "</td><td>석식 합계</td><td>", String(statement.dinnerQuantity), "식</td><td>", formatWon(statement.dinnerAmount), "</td></tr>",
    "<tr><td colspan=\"5\">합계</td><td colspan=\"2\">", String(statement.totalQuantity), "식 / ", formatWon(statement.totalAmount), "</td></tr></tbody></table>",
    "<div class=\"account\">입금 계좌: ", escapeHtml(accountText || "미입력"), "&nbsp;&nbsp;&nbsp; 예금주: ", escapeHtml(supplier.accountHolder || "미입력"), "</div>",
    "<p class=\"note\">작성일: ", escapeHtml(todayKey()), " / 단가는 VAT 포함 기준입니다.</p></main></body></html>"
  ].join(""));
  documentRef.close();
  window.setTimeout(() => {
    target.focus();
    target.print();
    window.setTimeout(() => frame.remove(), 1000);
  }, 100);
}

function Field({ label, value, onChange, type = "text", placeholder = "" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "number";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black text-stone-600">{label}</span>
      <input
        className="focus-ring mt-1 h-10 w-full rounded-md border border-stone-300 px-3 text-sm font-semibold"
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TransactionStatementPanel({
  month,
  adminName,
  store
}: {
  month: string;
  adminName: string;
  store: ReturnType<typeof useBapsimStore>;
}) {
  const { state } = store;
  const [accountId, setAccountId] = useState("");
  const [supplierForm, setSupplierForm] = useState(state.supplierProfile);
  const [billingAddress, setBillingAddress] = useState("");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("8000");
  const activeAccountId = state.settlementAccounts.some((account) => account.id === accountId)
    ? accountId
    : state.settlementAccounts[0]?.id ?? "";
  const statement = useMemo(
    () => activeAccountId ? getTransactionStatement(state, activeAccountId, month) : undefined,
    [activeAccountId, month, state]
  );
  const supplierReady = store.storageMode === "local" || state.supplierProfileStorageReady;
  const accountDetailsReady = store.storageMode === "local" || state.settlementAccountDetailsStorageReady;

  useEffect(() => {
    setSupplierForm(state.supplierProfile);
  }, [state.supplierProfile]);

  useEffect(() => {
    if (!statement) {
      return;
    }
    setBillingAddress(statement.account.billingAddress ?? "");
    setDefaultUnitPrice(String(statement.account.defaultUnitPrice ?? 8000));
  }, [statement?.account.billingAddress, statement?.account.defaultUnitPrice, statement?.account.id]);

  const supplierDirty = JSON.stringify(supplierForm) !== JSON.stringify(state.supplierProfile);
  const selectedPrice = Math.max(0, Math.floor(Number(defaultUnitPrice) || 0));
  const accountDirty = !!statement && (
    billingAddress.trim() !== (statement.account.billingAddress ?? "") ||
    selectedPrice !== (statement.account.defaultUnitPrice ?? 8000)
  );

  if (!statement) {
    return <p className="mt-5 text-sm font-bold text-stone-500">등록된 정산 업체가 없습니다.</p>;
  }

  return (
    <div className="mt-5 space-y-5">
      {(!supplierReady || !accountDetailsReady) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          거래명세표 정보 저장을 사용하려면 Supabase SQL Editor에서 <code>docs/supabase-transaction-statements-migration.sql</code>을 한 번 실행하세요. 실행 전에도 미리보기와 기존 월별 집계는 사용할 수 있습니다.
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label className="block">
            <span className="text-xs font-black text-stone-600">거래명세표 대상 업체</span>
            <select className="focus-ring mt-1 h-10 w-full max-w-md rounded-md border border-stone-300 bg-white px-3 text-sm font-bold" value={activeAccountId} onChange={(event) => setAccountId(event.target.value)}>
              {state.settlementAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => downloadExcel(`bapsim-transaction-${statement.account.name}-${month}.xlsx`, buildTransactionStatementRows(statement, state.supplierProfile))}>
            <Download size={16} /> 엑셀
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => printTransactionStatement(statement, state.supplierProfile)}>
            <Printer size={16} /> 인쇄
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border border-stone-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-black">공급자 및 계좌 정보</h3><p className="mt-1 text-xs font-semibold text-stone-500">모든 거래명세표에 공통으로 표시됩니다.</p></div>
            <button className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300" title="공급자 정보 저장" disabled={!supplierReady || !supplierDirty} onClick={() => store.updateSupplierProfile({
              businessName: supplierForm.businessName,
              businessRegistrationNumber: supplierForm.businessRegistrationNumber,
              address: supplierForm.address,
              phone: supplierForm.phone,
              email: supplierForm.email,
              bankName: supplierForm.bankName,
              bankAccountNumber: supplierForm.bankAccountNumber,
              accountHolder: supplierForm.accountHolder
            }, adminName)}><Save size={16} /></button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="상호" value={supplierForm.businessName} onChange={(businessName) => setSupplierForm((current) => ({ ...current, businessName }))} />
            <Field label="사업자등록번호" value={supplierForm.businessRegistrationNumber} onChange={(businessRegistrationNumber) => setSupplierForm((current) => ({ ...current, businessRegistrationNumber }))} />
            <div className="md:col-span-2"><Field label="사업장 주소" value={supplierForm.address} onChange={(address) => setSupplierForm((current) => ({ ...current, address }))} /></div>
            <Field label="전화번호" value={supplierForm.phone} onChange={(phone) => setSupplierForm((current) => ({ ...current, phone }))} />
            <Field label="이메일" type="email" value={supplierForm.email} onChange={(email) => setSupplierForm((current) => ({ ...current, email }))} />
            <Field label="은행" value={supplierForm.bankName} onChange={(bankName) => setSupplierForm((current) => ({ ...current, bankName }))} />
            <Field label="계좌번호" value={supplierForm.bankAccountNumber} onChange={(bankAccountNumber) => setSupplierForm((current) => ({ ...current, bankAccountNumber }))} />
            <Field label="예금주" value={supplierForm.accountHolder} onChange={(accountHolder) => setSupplierForm((current) => ({ ...current, accountHolder }))} />
          </div>
        </section>

        <section className="border border-stone-200 p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">{statement.account.name} 청구 정보</h3><p className="mt-1 text-xs font-semibold text-stone-500">기본 단가는 이후 월에 적용되며, 특정 달의 예외 단가는 기존 월별 집계에서 수정합니다.</p></div>
            <button className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300" title="업체 청구 정보 저장" disabled={!accountDetailsReady || !accountDirty} onClick={() => store.updateSettlementAccount(statement.account.id, { name: statement.account.name, status: statement.account.status, billingAddress, defaultUnitPrice: selectedPrice }, adminName)}><Save size={16} /></button>
          </div>
          <div className="mt-4 grid gap-3">
            <Field label="공급받는자 주소" value={billingAddress} onChange={setBillingAddress} placeholder="거래명세표에 표시할 업체 주소" />
            <Field label="기본 단가 (VAT 포함)" type="number" value={defaultUnitPrice} onChange={setDefaultUnitPrice} />
          </div>
          <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-700">{monthLabel(month)} 거래명세표 적용 단가: <span className="text-bapsim-red">{formatWon(statement.unitPrice)}</span></div>
        </section>
      </div>

      <section className="overflow-hidden border border-stone-900 bg-white text-[11px] text-stone-950">
        <div className="border-b border-stone-900 py-2 text-center"><h2 className="text-lg font-black">거래명세서 <span className="text-xs">(거래명세표)</span></h2></div>
        <div className="grid border-b border-stone-900 md:grid-cols-2">
          <div className="border-b border-stone-900 p-3 md:border-b-0 md:border-r"><p className="font-black">공급받는자</p><p className="mt-2"><b>상호</b> {statement.account.name}</p><p className="mt-1 break-words"><b>주소</b> {statement.account.billingAddress || "미입력"}</p></div>
          <div className="p-3"><p className="font-black">공급자</p><p className="mt-2"><b>상호</b> {state.supplierProfile.businessName || "밥심"} <span className="ml-3"><b>사업자등록번호</b> {state.supplierProfile.businessRegistrationNumber || "미입력"}</span></p><p className="mt-1"><b>사업장 주소</b> {state.supplierProfile.address || "미입력"}</p><p className="mt-1"><b>전화번호</b> {state.supplierProfile.phone || "미입력"} <span className="ml-3"><b>이메일</b> {state.supplierProfile.email || "미입력"}</span></p></div>
        </div>
        <div className="border-b border-stone-900 px-3 py-2 font-black">거래 기간: {monthLabel(month)} <span className="ml-4">합계금액: {formatWon(statement.totalAmount)} (VAT 포함)</span></div>
        <div className="overflow-x-auto"><table className="min-w-[660px] w-full table-fixed border-collapse"><thead><tr className="bg-stone-100 text-center text-xs font-black"><th className="border-b border-r border-stone-900 px-2 py-2">일자</th><th className="border-b border-r border-stone-900 px-2 py-2">품목</th><th className="border-b border-r border-stone-900 px-2 py-2">단위</th><th className="border-b border-r border-stone-900 px-2 py-2">수량</th><th className="border-b border-r border-stone-900 px-2 py-2">단가</th><th className="border-b border-r border-stone-900 px-2 py-2">금액</th><th className="border-b border-stone-900 px-2 py-2">비고</th></tr></thead><tbody>
          {statement.days.flatMap((day) => [{ item: "중식", quantity: day.lunchQuantity, amount: day.lunchAmount }, { item: "석식", quantity: day.dinnerQuantity, amount: day.dinnerAmount }].filter((row) => row.quantity > 0).map((row) => ({ ...row, date: day.date }))).map((row) => <tr key={row.date + row.item}><td className="border-b border-r border-stone-900 px-2 py-2 text-center">{row.date}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-center font-black">{row.item}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-center">식</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right font-black">{row.quantity}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right">{formatWon(statement.unitPrice)}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right font-black">{formatWon(row.amount)}</td><td className="border-b border-stone-900 px-2 py-2">&nbsp;</td></tr>)}
        </tbody></table></div>
        <div className="grid border-b border-stone-900 text-center text-xs font-black md:grid-cols-3"><div className="border-b border-stone-900 p-3 md:border-b-0 md:border-r">중식 합계: {statement.lunchQuantity}식 / {formatWon(statement.lunchAmount)}</div><div className="border-b border-stone-900 p-3 md:border-b-0 md:border-r">석식 합계: {statement.dinnerQuantity}식 / {formatWon(statement.dinnerAmount)}</div><div className="p-3">합계: {statement.totalQuantity}식 / {formatWon(statement.totalAmount)}</div></div>
        <div className="px-3 py-3 text-center text-xs font-black">입금 계좌: {[state.supplierProfile.bankName, state.supplierProfile.bankAccountNumber].filter(Boolean).join(" ") || "미입력"} <span className="ml-3">예금주: {state.supplierProfile.accountHolder || "미입력"}</span></div>
      </section>
    </div>
  );
}
