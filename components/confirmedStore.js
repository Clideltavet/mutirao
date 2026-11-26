import { acceptSequence } from "./sequenceState";
export const keys = {
  patients: "deltaVetConfirmedPatients",
  clients: "deltaVetConfirmedClients",
  procedures: "deltaVetConfirmedProcedures",
  auditLog: "deltaVetConfirmedAuditLog",
};
export function read(key, fallback = []) {
  try {
    return (
      JSON.parse(
        (key.startsWith("deltaVetConfirmed")
          ? sessionStorage
          : localStorage
        ).getItem(key) || "null",
      ) ?? fallback
    );
  } catch {
    return fallback;
  }
}
export function identity(p) {
  return (
    p?._key ||
    p?.id ||
    `${p?.number ?? "sem-ficha"}::${p?.createdAt || "sem-data"}`
  );
}
export function patientPath(p) {
  return encodeURIComponent(identity(p));
}
export function findPatient(items, key) {
  return items.find((p) => identity(p) === decodeURIComponent(key));
}
let inFlight = null;
export async function refreshConfirmed() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const response = await fetch("/api/sync/shared", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Leitura não confirmada.");
    const last = Number(
      sessionStorage.getItem("deltaVetConfirmedRevision") || -1,
    );
    if (data.revision >= last) {
      for (const [field, key] of Object.entries(keys))
        sessionStorage.setItem(key, JSON.stringify(data[field] || []));
      sessionStorage.setItem(
        "deltaVetConfirmedSettings",
        JSON.stringify(data.settings || {}),
      );
      for (const [key, setting] of Object.entries(data.settings || {}))
        sessionStorage.setItem(
          key.replace("deltaVet", "deltaVetConfirmed"),
          JSON.stringify(setting.value),
        );
      sessionStorage.setItem(
        "deltaVetConfirmedRevision",
        String(data.revision),
      );
      acceptSequence(data);
      localStorage.setItem("deltaVetLastNeonSync", data.syncedAt);
      window.dispatchEvent(
        new CustomEvent("deltaVetRemoteSync", { detail: data }),
      );
    }
    return data;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
export async function sendCommand(cmd) {
  const sig = JSON.stringify(cmd);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(sig),
  );
  const journalKey =
    "deltaVetOperation:" +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  let pending = read(journalKey, null);
  if (!pending) {
    pending = {
      signature: sig,
      command: { ...cmd, requestId: crypto.randomUUID() },
      at: new Date().toISOString(),
    };
    localStorage.setItem(journalKey, JSON.stringify(pending));
  }
  const response = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pending.command),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    if (response.status === 409)
      window.dispatchEvent(new CustomEvent("deltaVetManualSyncRequest"));
    throw new Error(
      data?.error ||
        "Sem confirmação do servidor. Tente novamente com os mesmos dados.",
    );
  }
  localStorage.setItem(
    journalKey,
    JSON.stringify({ ...pending, confirmed: true, receipt: data }),
  );
  const cacheKey = keys[cmd.kind];
  if (
    cacheKey &&
    data.revision >=
      Number(sessionStorage.getItem("deltaVetConfirmedRevision") || -1)
  ) {
    const all = read(cacheKey, []),
      existing = all.find((x) => identity(x) === cmd.key);
    if (
      !existing ||
      Number(existing._revision) <= Number(data.record._revision)
    ) {
      const next = all.filter((x) => identity(x) !== cmd.key);
      if (cmd.op !== "delete") next.push(data.record);
      sessionStorage.setItem(cacheKey, JSON.stringify(next));
    }
  }
  sessionStorage.setItem(
    "deltaVetConfirmedRevision",
    String(
      Math.max(
        Number(sessionStorage.getItem("deltaVetConfirmedRevision") || 0),
        data.revision,
      ),
    ),
  );
  acceptSequence(data);
  window.dispatchEvent(new CustomEvent("deltaVetManualSyncRequest"));
  return data;
}
export async function saveRecord(kind, record, payload, action) {
  return sendCommand({
    op: record?._key ? "update" : "create",
    kind,
    key: identity(record),
    expectedRevision: record?._revision ?? 0,
    payload,
    action,
  });
}
export async function updatePatient(patient, payload, action) {
  return sendCommand({
    op: "update",
    kind: "patients",
    key: identity(patient),
    expectedRevision: patient._revision,
    payload,
    action,
  });
}
export async function deleteRecord(kind, record, reason) {
  return sendCommand({
    op: "delete",
    kind,
    key: identity(record),
    expectedRevision: record._revision,
    reason,
  });
}
export async function saveSetting(key, value, expected) {
  const prior = read("deltaVetConfirmedSettings", {})[key];
  const result = await sendCommand({
    op: prior ? "update" : "create",
    kind: "settings",
    key,
    expectedRevision: expected ?? prior?.revision ?? 0,
    payload: { value },
  });
  await refreshConfirmed();
  return result;
}
export async function confirmedAction(fn) {
  try {
    return await fn();
  } catch (e) {
    window.alert(e.message);
    return null;
  }
}
