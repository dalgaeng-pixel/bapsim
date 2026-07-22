"use client";

import { Download, Printer, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildTransactionStatementRows, downloadExcel } from "@/lib/export";
import { todayKey } from "@/lib/date";
import {
  getTransactionStatement,
  type TransactionStatement,
  type TransactionStatementLocation
} from "@/lib/transaction-statement";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import type { SupplierProfile } from "@/lib/types";

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function monthLabel(month: string) {
  const parts = month.split("-");
  return parts[0] + "년 " + Number(parts[1]) + "월";
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

function locationTableHtml(
  location: TransactionStatementLocation,
  unitPrice: number
) {
  const rows = [
    ...location.days,
    ...Array.from({ length: Math.max(0, 20 - location.days.length) }, () => null)
  ];
  const rowHtml = rows.map((day) => day
    ? [
        "<tr><td>", escapeHtml(day.date), "</td><td>", day.lunchQuantity ? String(day.lunchQuantity) : "", "</td><td>",
        day.dinnerQuantity ? String(day.dinnerQuantity) : "", "</td><td>", formatWon(day.totalAmount), "</td><td>",
        escapeHtml(day.memo ?? ""), "</td></tr>"
      ].join("")
    : "<tr class=\"blank\"><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>"
  ).join("");

  return [
    "<section class=\"location\">",
    "<div class=\"location-title\"><strong>", escapeHtml(location.client.name),
    "</strong><span>단가 ", formatWon(unitPrice), " (VAT 포함)</span></div>",
    "<table><thead><tr><th>일자</th><th>중식</th><th>석식</th><th>금액</th><th>비고</th></tr></thead><tbody>",
    rowHtml,
    "</tbody></table>",
    "<div class=\"location-total\">장소 소계: 중식 ", String(location.lunchQuantity), "식 / 석식 ",
    String(location.dinnerQuantity), "식 / ", formatWon(location.totalAmount), "</div>",
    "</section>"
  ].join("");
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

  const accountText = [supplier.bankName, supplier.bankAccountNumber].filter(Boolean).join(" ");
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(statement.locations.length / 4)) },
    (_, index) => statement.locations.slice(index * 4, index * 4 + 4)
  );
  const pageHtml = pages.map((locations) => {
    const count = locations.length;
    const layout = count === 1 ? "one" : count === 2 ? "two" : "four";
    return [
      "<section class=\"page\">",
      "<div class=\"title\">거래명세서 <small>(거래명세표)</small></div>",
      "<section class=\"head\">",
      "<div class=\"recipient\"><div class=\"head-title\">공급받는자</div>",
      "<div class=\"field\"><b>거래 기간</b><span>", escapeHtml(monthLabel(statement.month)), "</span></div>",
      "<div class=\"field\"><b>상호</b><span>", escapeHtml(statement.account.name), "</span></div>",
      "<div class=\"field\"><b>주소</b><span>", escapeHtml(statement.account.billingAddress || "미입력"), "</span></div></div>",
      "<div><div class=\"head-title\">공급자</div><div class=\"supplier\">",
      "<div class=\"field\"><b>사업자등록번호</b><span>", escapeHtml(supplier.businessRegistrationNumber || "미입력"), "</span></div>",
      "<div class=\"field\"><b>상호</b><span>", escapeHtml(supplier.businessName || "밥심"), "</span></div>",
      "<div class=\"field wide\"><b>사업장 주소</b><span>", escapeHtml(supplier.address || "미입력"), "</span></div>",
      "<div class=\"field\"><b>전화번호</b><span>", escapeHtml(supplier.phone || "미입력"), "</span></div>",
      "<div class=\"field\"><b>이메일</b><span>", escapeHtml(supplier.email || "미입력"), "</span></div>",
      "</div></div></section>",
      "<div class=\"total\">합계금액:<strong>", formatWon(statement.totalAmount), "</strong>&nbsp;&nbsp;(VAT 포함)</div>",
      "<div class=\"locations ", layout, "\">",
      locations.map((location) => locationTableHtml(location, statement.unitPrice)).join(""),
      "</div>",
      "<div class=\"foot\"><span>중식·석식은 같은 일자 행에서 구분 표기</span><span>입금 계좌: ",
      escapeHtml(accountText || "미입력"), " / 예금주: ", escapeHtml(supplier.accountHolder || "미입력"), "</span></div>",
      "</section>"
    ].join("");
  }).join("");

  documentRef.open();
  documentRef.write([
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>거래명세서</title><style>",
    "*{box-sizing:border-box}@page{size:A4 portrait;margin:7mm}",
    "body{margin:0;color:#111;font-family:Arial,\"Malgun Gothic\",sans-serif;font-size:8px}.page{width:196mm;min-height:283mm;page-break-after:always}.page:last-child{page-break-after:auto}",
    ".title{height:8mm;border:1px solid #111;border-bottom:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800}.title small{margin-left:2mm;font-size:8px}",
    ".head{display:grid;grid-template-columns:42% 58%;border:1px solid #111}.recipient{border-right:1px solid #111}.head-title{height:6mm;border-bottom:1px solid #111;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}",
    ".field{display:grid;grid-template-columns:24mm 1fr;min-height:5.8mm;border-bottom:1px solid #111}.field:last-child{border-bottom:0}.field b{display:flex;align-items:center;justify-content:center;border-right:1px solid #111;background:#fafafa}.field span{display:flex;align-items:center;padding:0 1.5mm;overflow-wrap:anywhere}",
    ".supplier{display:grid;grid-template-columns:1fr 1fr}.supplier .field:nth-child(odd){border-right:1px solid #111}.supplier .wide{grid-column:span 2}.supplier .field:nth-last-child(-n+2){border-bottom:0}",
    ".total{height:6.5mm;border:1px solid #111;border-top:0;padding:0 2mm;display:flex;align-items:center;font-weight:800}.total strong{font-size:10px;margin-left:4mm}",
    ".locations{height:220mm;display:grid;gap:2mm;padding-top:2mm}.locations.one{grid-template-columns:1fr}.locations.two{grid-template-columns:1fr;grid-template-rows:1fr 1fr}.locations.four{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}",
    ".location{border:1px solid #111;overflow:hidden}.location-title{height:6mm;border-bottom:1px solid #111;display:flex;align-items:center;justify-content:space-between;padding:0 2mm;font-size:10px}.location-title span{font-size:7px;font-weight:600}",
    "table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{height:4.15mm;border-right:1px solid #111;border-bottom:1px solid #111;padding:0 .8mm;text-align:center;white-space:nowrap}th{height:5mm;background:#f5f5f5;font-weight:800}th:nth-child(1){width:18%}th:nth-child(2),th:nth-child(3){width:14%}th:nth-child(4){width:22%}th:nth-child(5){width:32%}td:nth-child(4){text-align:right}td:nth-child(5){text-align:left}.locations.one td{height:6.1mm}.locations.two td{height:4.4mm}.blank td{color:transparent}",
    ".location-total{height:6mm;border-top:0;display:flex;align-items:center;justify-content:flex-end;padding:0 2mm;font-weight:800}.foot{height:8mm;border:1px solid #111;display:flex;align-items:center;justify-content:space-between;padding:0 3mm;font-size:7px;font-weight:800}",
    "</style></head><body>", pageHtml, "</body></html>"
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
      <input className="focus-ring mt-1 h-10 w-full rounded-md border border-stone-300 px-3 text-sm font-semibold" type={type} min={type === "number" ? 0 : undefined} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function remarkKey(clientId: string, date: string) {
  return clientId + ":" + date;
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
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({});
  const activeAccountId = state.settlementAccounts.some((account) => account.id === accountId)
    ? accountId
    : state.settlementAccounts[0]?.id ?? "";
  const statement = useMemo(
    () => activeAccountId ? getTransactionStatement(state, activeAccountId, month) : undefined,
    [activeAccountId, month, state]
  );
  const supplierReady = store.storageMode === "local" || state.supplierProfileStorageReady;
  const accountDetailsReady = store.storageMode === "local" || state.settlementAccountDetailsStorageReady;
  const remarksReady = store.storageMode === "local" || state.transactionStatementRemarksStorageReady;

  useEffect(() => {
    setSupplierForm(state.supplierProfile);
  }, [state.supplierProfile]);

  useEffect(() => {
    if (!statement) {
      return;
    }
    setBillingAddress(statement.account.billingAddress ?? "");
    setDefaultUnitPrice(String(statement.account.defaultUnitPrice ?? 8000));
    setRemarkDrafts(Object.fromEntries(statement.locations.flatMap((location) =>
      location.days.map((day) => [remarkKey(location.client.id, day.date), day.memo ?? ""])
    )));
  }, [statement?.account.id, month, state.transactionStatementRemarks]);

  if (!statement) {
    return <p className="mt-5 text-sm font-bold text-stone-500">등록된 정산 업체가 없습니다.</p>;
  }

  const selectedPrice = Math.max(0, Math.floor(Number(defaultUnitPrice) || 0));
  const supplierDirty = JSON.stringify(supplierForm) !== JSON.stringify(state.supplierProfile);
  const accountDirty = billingAddress.trim() !== (statement.account.billingAddress ?? "") ||
    selectedPrice !== (statement.account.defaultUnitPrice ?? 8000);
  const remarkRows = statement.locations.flatMap((location) =>
    location.days.map((day) => ({ location, day, key: remarkKey(location.client.id, day.date) }))
  );
  const changedRemarks = remarkRows.filter((row) =>
    (remarkDrafts[row.key] ?? "") !== (row.day.memo ?? "")
  );
  const locationClass = statement.locations.length === 1
    ? "grid-cols-1"
    : statement.locations.length === 2
      ? "grid-cols-1"
      : "md:grid-cols-2";

  return (
    <div className="mt-5 space-y-5">
      {(!supplierReady || !accountDetailsReady || !remarksReady) ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          공급자 정보, 청구 정보 또는 거래명세서 비고를 Supabase에 저장하려면 관련 SQL 마이그레이션을 실행해야 합니다.
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <label className="block min-w-0 flex-1">
          <span className="text-xs font-black text-stone-600">거래명세표 정산 업체</span>
          <select className="focus-ring mt-1 h-10 w-full max-w-md rounded-md border border-stone-300 bg-white px-3 text-sm font-bold" value={activeAccountId} onChange={(event) => setAccountId(event.target.value)}>
            {state.settlementAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => downloadExcel("bapsim-transaction-" + statement.account.name + "-" + month + ".xlsx", buildTransactionStatementRows(statement, state.supplierProfile))}>
            <Download size={16} /> 엑셀
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black disabled:bg-stone-100" title={changedRemarks.length ? "비고를 먼저 저장하세요." : "A4 거래명세서 인쇄"} disabled={changedRemarks.length > 0} onClick={() => printTransactionStatement(statement, state.supplierProfile)}>
            <Printer size={16} /> 인쇄
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="border border-stone-200 p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">공급자·계좌 정보</h3><p className="mt-1 text-xs font-semibold text-stone-500">모든 거래명세서에 공통으로 출력됩니다.</p></div><button className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300" title="공급자 정보 저장" disabled={!supplierReady || !supplierDirty} onClick={() => store.updateSupplierProfile(supplierForm, adminName)}><Save size={16} /></button></div>
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
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">{statement.account.name} 청구 정보</h3><p className="mt-1 text-xs font-semibold text-stone-500">기본 단가는 이후 달에도 적용되며, 해당 월의 예외 단가는 월별 집계에서 수정합니다.</p></div><button className="focus-ring rounded-md bg-bapsim-red p-2 text-white disabled:bg-stone-300" title="청구 정보 저장" disabled={!accountDetailsReady || !accountDirty} onClick={() => store.updateSettlementAccount(statement.account.id, { name: statement.account.name, status: statement.account.status, billingAddress, defaultUnitPrice: selectedPrice }, adminName)}><Save size={16} /></button></div>
          <div className="mt-4 grid gap-3"><Field label="공급받는자 주소" value={billingAddress} onChange={setBillingAddress} /><Field label="기본 단가 (VAT 포함)" type="number" value={defaultUnitPrice} onChange={setDefaultUnitPrice} /></div>
          <div className="mt-4 rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-700">{monthLabel(month)} 적용 단가: <span className="text-bapsim-red">{formatWon(statement.unitPrice)}</span></div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-y border-stone-200 py-3">
        <div><h3 className="font-black">거래명세서 비고</h3><p className="mt-1 text-xs font-semibold text-stone-500">날짜와 배달 장소별 비고입니다. 저장된 내용만 인쇄·PDF에 반영됩니다.</p></div>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-bapsim-red px-3 py-2 text-sm font-black text-white disabled:bg-stone-300" disabled={!remarksReady || changedRemarks.length === 0} onClick={() => store.updateTransactionStatementRemarks(statement.account.id, changedRemarks.map((row) => ({ clientId: row.location.client.id, date: row.day.date, memo: remarkDrafts[row.key] ?? "" })), adminName)}>
          <Save size={16} /> 비고 저장
        </button>
      </div>

      <section className="overflow-hidden border border-stone-900 bg-white text-[11px] text-stone-950">
        <div className="border-b border-stone-900 py-2 text-center"><h2 className="text-lg font-black">거래명세서 <span className="text-xs">(거래명세표)</span></h2><p className="mt-1 text-xs font-semibold">거래 기간 {monthLabel(month)} · 합계금액 {formatWon(statement.totalAmount)} (VAT 포함)</p></div>
        <div className={"grid gap-2 p-2 " + locationClass}>
          {statement.locations.map((location) => <section key={location.client.id} className="overflow-x-auto border border-stone-900"><div className="flex items-center justify-between border-b border-stone-900 px-3 py-2"><h3 className="font-black">{location.client.name}</h3><span className="text-xs font-bold">단가 {formatWon(statement.unitPrice)}</span></div><table className="min-w-[600px] w-full border-collapse"><thead><tr className="bg-stone-100 text-center text-xs font-black"><th className="border-b border-r border-stone-900 px-2 py-2">일자</th><th className="border-b border-r border-stone-900 px-2 py-2">중식</th><th className="border-b border-r border-stone-900 px-2 py-2">석식</th><th className="border-b border-r border-stone-900 px-2 py-2">금액</th><th className="border-b border-stone-900 px-2 py-2">비고</th></tr></thead><tbody>{location.days.map((day) => { const key = remarkKey(location.client.id, day.date); return <tr key={key}><td className="border-b border-r border-stone-900 px-2 py-2 text-center">{day.date}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right font-black">{day.lunchQuantity || ""}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right font-black">{day.dinnerQuantity || ""}</td><td className="border-b border-r border-stone-900 px-2 py-2 text-right font-black">{formatWon(day.totalAmount)}</td><td className="border-b border-stone-900 p-1"><input className="focus-ring h-8 w-full min-w-32 border-0 bg-transparent px-1 text-xs" value={remarkDrafts[key] ?? ""} placeholder="비고 입력" onChange={(event) => setRemarkDrafts((current) => ({ ...current, [key]: event.target.value }))} /></td></tr>; })}</tbody></table><div className="border-t border-stone-900 px-3 py-2 text-right text-xs font-black">장소 소계: 중식 {location.lunchQuantity}식 / 석식 {location.dinnerQuantity}식 / {formatWon(location.totalAmount)}</div></section>)}
        </div>
        <div className="border-t border-stone-900 px-3 py-3 text-center text-xs font-black">월 합계: 중식 {statement.lunchQuantity}식 / 석식 {statement.dinnerQuantity}식 / {formatWon(statement.totalAmount)}</div>
      </section>
    </div>
  );
}
