"use client";

import { AlertTriangle, Building2, KeyRound, Link, Pencil, PlusCircle, Power, Save, Trash2, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getClientsForContactAccessGroup, getClientsForSettlementAccount } from "@/lib/contact-groups";
import { useBapsimStore } from "@/lib/use-bapsim-store";
import type { ContactAccessGroup } from "@/lib/types";

type ContactGroupForm = {
  name: string;
  managerName: string;
  managerPhone: string;
  status: ContactAccessGroup["status"];
  clientIds: string[];
};

const emptyContactGroupForm: ContactGroupForm = {
  name: "",
  managerName: "",
  managerPhone: "",
  status: "active",
  clientIds: []
};

export function GroupManager({ adminName, store }: { adminName: string; store: ReturnType<typeof useBapsimStore> }) {
  const [settlementName, setSettlementName] = useState("");
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactGroupForm>(emptyContactGroupForm);
  const [error, setError] = useState("");

  const clientsById = useMemo(
    () => new Map(store.state.clients.map((client) => [client.id, client])),
    [store.state.clients]
  );

  if (!store.state.groupStorageReady && store.storageMode !== "local") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-soft">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0" size={20} />
          <div>
            <h2 className="text-xl font-black">정산·담당자 그룹 설정 필요</h2>
            <p className="mt-2 text-sm font-semibold">
              Supabase SQL Editor에서 <code>docs/supabase-contact-groups-migration.sql</code>을 한 번 실행한 뒤 새로고침하세요.
              기존 거래처 링크와 PIN은 그대로 이전됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const startCreateGroup = () => {
    setEditingGroupId(null);
    setContactForm(emptyContactGroupForm);
    setError("");
    setContactFormOpen(true);
  };

  const startEditGroup = (group: ContactAccessGroup) => {
    setEditingGroupId(group.id);
    setContactForm({
      name: group.name,
      managerName: group.managerName,
      managerPhone: group.managerPhone,
      status: group.status,
      clientIds: getClientsForContactAccessGroup(store.state, group.id).map((client) => client.id)
    });
    setError("");
    setContactFormOpen(true);
  };

  const saveContactGroup = () => {
    if (!contactForm.name.trim() || contactForm.clientIds.length === 0) {
      setError("그룹명과 연결할 배송 장소를 입력하세요.");
      return;
    }

    if (editingGroupId) {
      store.updateContactAccessGroup(editingGroupId, contactForm, adminName);
    } else {
      store.createContactAccessGroup(contactForm, adminName);
    }
    setContactFormOpen(false);
    setEditingGroupId(null);
    setContactForm(emptyContactGroupForm);
  };

  const copyInviteLink = (group: ContactAccessGroup) => {
    const link = `${window.location.origin}/client/${group.inviteCode}`;
    const message = `밥심 식사배달관리 담당자 전용 링크입니다.\n\n▶ 접속 링크: ${link}\n▶ 보안 PIN: ${group.invitePin}`;
    navigator.clipboard.writeText(message).then(() => alert("담당자 링크와 PIN이 복사되었습니다."));
  };

  return (
    <div className="space-y-5">
      <section className="border-b border-stone-200 pb-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-black">정산 업체</h2>
            <p className="text-sm font-semibold text-stone-500">월별 집계와 계산서 발행 기준입니다.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              className="focus-ring min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-bold sm:w-52"
              placeholder="예: 한울상사"
              value={settlementName}
              onChange={(event) => setSettlementName(event.target.value)}
            />
            <button
              className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-md bg-bapsim-red px-3 py-2 text-sm font-black text-white"
              onClick={() => {
                store.createSettlementAccount(settlementName, adminName);
                setSettlementName("");
              }}
              disabled={!settlementName.trim()}
            >
              <PlusCircle size={16} />
              등록
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {store.state.settlementAccounts.map((account) => {
            const locations = getClientsForSettlementAccount(store.state, account.id);
            return (
              <div key={account.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{account.name}</p>
                    <p className="mt-1 text-sm font-semibold text-stone-500">
                      {locations.length ? locations.map((client) => client.name).join(" · ") : "연결된 배송 장소 없음"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${account.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                    {account.status === "active" ? "사용 중" : "일시중지"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                    onClick={() => {
                      const name = window.prompt("정산 업체명", account.name);
                      if (name !== null) {
                        store.updateSettlementAccount(account.id, { name, status: account.status }, adminName);
                      }
                    }}
                  >
                    <Pencil size={15} />
                    이름 수정
                  </button>
                  <button
                    className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black"
                    onClick={() => store.updateSettlementAccount(account.id, { name: account.name, status: account.status === "active" ? "paused" : "active" }, adminName)}
                  >
                    <Power size={15} />
                    {account.status === "active" ? "일시중지" : "사용 재개"}
                  </button>
                  {locations.length === 0 ? (
                    <button
                      className="focus-ring inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"
                      onClick={() => store.deleteSettlementAccount(account.id, adminName)}
                    >
                      <Trash2 size={15} />
                      삭제
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-black">담당자 접속 그룹</h2>
            <p className="text-sm font-semibold text-stone-500">링크와 PIN 하나로 관리할 배송 장소를 묶습니다.</p>
          </div>
          <button
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-bapsim-red px-4 py-3 text-sm font-black text-white"
            onClick={startCreateGroup}
          >
            <Users size={17} />
            담당자 그룹 등록
          </button>
        </div>

        {contactFormOpen ? (
          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="그룹명" value={contactForm.name} onChange={(name) => setContactForm((current) => ({ ...current, name }))} />
              <Field label="담당자명" value={contactForm.managerName} onChange={(managerName) => setContactForm((current) => ({ ...current, managerName }))} />
              <Field label="담당자 연락처" value={contactForm.managerPhone} onChange={(managerPhone) => setContactForm((current) => ({ ...current, managerPhone }))} />
              <label className="block">
                <span className="text-sm font-black text-stone-700">사용 상태</span>
                <select
                  className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3"
                  value={contactForm.status}
                  onChange={(event) => setContactForm((current) => ({ ...current, status: event.target.value as ContactAccessGroup["status"] }))}
                >
                  <option value="active">사용 중</option>
                  <option value="paused">일시중지</option>
                </select>
              </label>
            </div>
            <div className="mt-4 border-t border-red-100 pt-4">
              <p className="text-sm font-black text-stone-700">접근 가능한 배송 장소</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {store.state.clients.map((client) => {
                  const checked = contactForm.clientIds.includes(client.id);
                  return (
                    <label key={client.id} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setContactForm((current) => ({
                          ...current,
                          clientIds: checked
                            ? current.clientIds.filter((clientId) => clientId !== client.id)
                            : [...current.clientIds, client.id]
                        }))}
                      />
                      {client.name}
                    </label>
                  );
                })}
              </div>
            </div>
            {error ? <p className="mt-3 text-sm font-black text-bapsim-red">{error}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-bapsim-red px-4 py-3 text-sm font-black text-white" onClick={saveContactGroup}>
                <Save size={17} />
                저장
              </button>
              <button className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-3 text-sm font-black" onClick={() => setContactFormOpen(false)}>
                취소
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {store.state.contactAccessGroups.map((group) => {
            const locations = getClientsForContactAccessGroup(store.state, group.id);
            return (
              <div key={group.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{group.name}</p>
                    <p className="mt-1 text-sm font-semibold text-stone-700">{group.managerName || "담당자 미입력"} · {group.managerPhone || "연락처 미입력"}</p>
                    <p className="mt-2 text-sm font-semibold text-stone-500">{locations.map((client) => client.name).join(" · ")}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${group.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>
                    {group.status === "active" ? "사용 중" : "일시중지"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="접속 코드" value={group.inviteCode} />
                  <Info label="PIN" value={group.invitePin} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => copyInviteLink(group)}>
                    <Link size={15} />
                    링크 복사
                  </button>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => startEditGroup(group)}>
                    <Pencil size={15} />
                    수정
                  </button>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => store.resetContactAccessGroupPin(group.id, adminName)}>
                    <KeyRound size={15} />
                    PIN 재발급
                  </button>
                  <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black" onClick={() => store.updateContactAccessGroup(group.id, {
                    name: group.name,
                    managerName: group.managerName,
                    managerPhone: group.managerPhone,
                    status: group.status === "active" ? "paused" : "active",
                    clientIds: locations.map((client) => client.id)
                  }, adminName)}>
                    <Power size={15} />
                    {group.status === "active" ? "일시중지" : "사용 재개"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-stone-700">{label}</span>
      <input className="focus-ring mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-3" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-100 px-3 py-2">
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="mt-1 break-all font-black text-stone-800">{value}</p>
    </div>
  );
}