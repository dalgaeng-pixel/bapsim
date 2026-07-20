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
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const target = frame.contentWindow;
  const documentRef = target?.document;
  if (!target || !documentRef) {
    frame.remove();
    window.alert("인쇄 창을 열 수 없습니다.");
    return;
  }

  const accountText = [supplier.bankName, supplier.bankAccountNumber].filter(Boolean).join(" ");
  const rowHtml = statement.days.map((day) => `
    <tr>
      <td>${escapeHtml(day.date)}</td>
      <td>식사</td>
      <td>${day.lunchQuantity ? `${day.lunchQuantity}개` : ""}</td>
      <td>${day.lunchQuantity ? formatWon(day.lunchAmount) : ""}</td>
      <td>${day.dinnerQuantity ? `${day.dinnerQuantity}개` : ""}</td>
      <td>${day.dinnerQuantity ? formatWon(day.dinnerAmount) : ""}</td>
      <td>${formatWon(statement.unitPrice)}</td>
      <td>${formatWon(day.totalAmount)}</td>
    </tr>`).join("");

  documentRef.open();
  documentRef.write(`<!doctype html>
    <html lang="ko"><head><meta charset="utf-8"/><title>거래명세표</title>
    <style>
      * { box-sizing: border-box; }
      @page { size: A4 portrait; margin: 12mm; }
      body { margin: 0; color: #171717; font-family: Arial, "Malgun Gothic", sans-serif; font-size: 11px; }
      h1 { margin: 0 0 7mm; text-align: center; font-size: 25px; letter-spacing: 0; }
      .period { margin-bottom: 4mm; text-align: right; font-weight: 700; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 5mm; }
      .party { border: 1px solid #222; min-height: 30mm; }
      .party h2 { margin: 0; padding: 2.5mm 3mm; border-bottom: 1px solid #222; background: #f5f5f5; font-size: 12px; }
      .party dl { display: grid; grid-template-columns: 27mm 1fr; margin: 0; }
      .party dt, .party dd { margin: 0; padding: 1.5mm 3mm; border-bottom: 1px solid #ddd; }
      .party dt { font-weight: 700; background: #fafafa; }
      .party dd:last-child, .party dt:nth-last-of-type(1) { border-bottom: 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #222; padding: 2.3mm 1.5mm; text-align: center; }
      th { background: #f3f3f3; font-weight: 700; }
      td:nth-child(1), td:nth-child(2) { text-align: left; }
      td:nth-child(n+3) { text-align: right; }
      .summary { margin-top: 4mm; width: 100%; }
      .summary td { text-align: right; }
      .summary td:first-child { text-align: left; font-weight: 700; }
      .total { font-size: 13px; font-weight: 700; }
      .account { margin-top: 5mm; border-top: 1px solid #222; padding-top: 3mm; font-size: 12px; font-weight: 700; }
    </style></head><body>
      <h1>거래명세표</h1>
      <div class="period">작성일 ${todayKey()} / 거래 기간 ${monthLabel(statement.month)}</div>
      <section class="parties">
        <div class="party"><h2>공급받는자</h2><dl>
          <dt>업체명</dt><dd>${escapeHtml(statement.account.name)}</dd>
          <dt>주소</dt><dd>${escapeHtml(statement.account.billingAddress || "")}</dd>
        </dl></div>
        <div class="party"><h2>공급자</h2><dl>
          <dt>상호</dt><dd>${escapeHtml(supplier.businessName || "밥심")}</dd>
          <dt>사업자등록번호</dt><dd>${escapeHtml(supplier.businessRegistrationNumber)}</dd>
          <dt>사업장 주소</dt><dd>${escapeHtml(supplier.address)}</dd>
          <dt>전화번호</dt><dd>${escapeHtml(supplier.phone)}</dd>
          <dt>이메일</dt><dd>${escapeHtml(supplier.email)}</dd>
        </dl></div>
      </section>
      <table><thead><tr><th>일자</th><th>품목</th><th>중식 수량</th><th>중식 금액</th><th>석식 수량</th><th>석식 금액</th><th>단가<br/>(VAT 포함)</th><th>일 합계</th></tr></thead>
      <tbody>${rowHtml || '<tr><td colspan="8">해당 기간의 정산 포함 납품 기록이 없습니다.</td></tr>'}</tbody></table>
      <table class="summary"><tbody>
        <tr><td>중식 합계</td><td>${statement.lunchQuantity}개 / ${formatWon(statement.lunchAmount)}</td></tr>
        <tr><td>석식 합계</td><td>${statement.dinnerQuantity}개 / ${formatWon(statement.dinnerAmount)}</td></tr>
        <tr class="total"><td>월 총 식수</td><td>${statement.totalQuantity}개 / ${formatWon(statement.totalAmount)}</td></tr>
      </tbody></table>
      <div class="account">입금 계좌: ${escapeHtml(accountText)} &nbsp;&nbsp; 예금주: ${escapeHtml(supplier.accountHolder)}</div>
    </body></html>`);
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

      <section className="overflow-hidden border border-stone-300 bg-white">
        <div className="border-b border-stone-300 px-4 py-5 text-center"><h2 className="text-2xl font-black">거래명세표</h2><p className="mt-2 text-sm font-bold text-stone-600">작성일 {todayKey()} · 거래 기간 {monthLabel(month)}</p></div>
        <div className="grid border-b border-stone-300 md:grid-cols-2">
          <InfoBlock title="공급받는자" rows={[["업체명", statement.account.name], ["주소", statement.account.billingAddress || "미입력"]]} />
          <InfoBlock title="공급자" rows={[["상호", state.supplierProfile.businessName || "밥심"], ["사업자등록번호", state.supplierProfile.businessRegistrationNumber || "미입력"], ["사업장 주소", state.supplierProfile.address || "미입력"], ["전화번호", state.supplierProfile.phone || "미입력"], ["이메일", state.supplierProfile.email || "미입력"]]} />
        </div>
        <div className="overflow-x-auto"><table className="min-w-[760px] w-full border-collapse text-sm"><thead><tr className="bg-stone-100 text-xs font-black text-stone-700"><th className="border-b border-r border-stone-300 px-3 py-3 text-left">일자</th><th className="border-b border-r border-stone-300 px-3 py-3 text-left">품목</th><th className="border-b border-r border-stone-300 px-3 py-3 text-right">중식 수량</th><th className="border-b border-r border-stone-300 px-3 py-3 text-right">중식 금액</th><th className="border-b border-r border-stone-300 px-3 py-3 text-right">석식 수량</th><th className="border-b border-r border-stone-300 px-3 py-3 text-right">석식 금액</th><th className="border-b border-r border-stone-300 px-3 py-3 text-right">단가(VAT 포함)</th><th className="border-b border-stone-300 px-3 py-3 text-right">일 합계</th></tr></thead><tbody>
          {statement.days.length ? statement.days.map((day) => <tr key={day.date} className="border-b border-stone-200"><td className="border-r border-stone-200 px-3 py-3 font-bold">{day.date}</td><td className="border-r border-stone-200 px-3 py-3">식사</td><td className="border-r border-stone-200 px-3 py-3 text-right font-bold">{day.lunchQuantity || ""}{day.lunchQuantity ? "개" : ""}</td><td className="border-r border-stone-200 px-3 py-3 text-right">{day.lunchQuantity ? formatWon(day.lunchAmount) : ""}</td><td className="border-r border-stone-200 px-3 py-3 text-right font-bold">{day.dinnerQuantity || ""}{day.dinnerQuantity ? "개" : ""}</td><td className="border-r border-stone-200 px-3 py-3 text-right">{day.dinnerQuantity ? formatWon(day.dinnerAmount) : ""}</td><td className="border-r border-stone-200 px-3 py-3 text-right">{formatWon(statement.unitPrice)}</td><td className="px-3 py-3 text-right font-black">{formatWon(day.totalAmount)}</td></tr>) : <tr><td colSpan={8} className="px-3 py-10 text-center font-bold text-stone-500">해당 기간의 정산 포함 납품 기록이 없습니다.</td></tr>}
        </tbody></table></div>
        <div className="grid border-t border-stone-300 text-sm md:grid-cols-3"><Summary label="중식 합계" value={`${statement.lunchQuantity}개 · ${formatWon(statement.lunchAmount)}`} /><Summary label="석식 합계" value={`${statement.dinnerQuantity}개 · ${formatWon(statement.dinnerAmount)}`} /><Summary label="월 총 식수" value={`${statement.totalQuantity}개 · ${formatWon(statement.totalAmount)}`} total /></div>
        <div className="border-t border-stone-300 px-4 py-4 text-sm font-black">입금 계좌: {[state.supplierProfile.bankName, state.supplierProfile.bankAccountNumber].filter(Boolean).join(" ") || "미입력"} <span className="ml-4">예금주: {state.supplierProfile.accountHolder || "미입력"}</span></div>
      </section>
    </div>
  );
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <div className="border-b border-stone-300 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><h3 className="font-black">{title}</h3><dl className="mt-3 space-y-2 text-sm">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3"><dt className="font-bold text-stone-500">{label}</dt><dd className="break-words font-semibold text-stone-800">{value}</dd></div>)}</dl></div>;
}

function Summary({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  return <div className={`border-b border-stone-300 px-4 py-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 ${total ? "bg-red-50" : ""}`}><p className="text-xs font-black text-stone-500">{label}</p><p className={`mt-1 text-base font-black ${total ? "text-bapsim-red" : ""}`}>{value}</p></div>;
}