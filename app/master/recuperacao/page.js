"use client";
import { useEffect, useState } from "react";
import {
  read,
  keys,
  identity,
  sendCommand,
  refreshConfirmed,
} from "../../../components/confirmedStore";
import { meApi } from "../../../components/authUtils";
export default function Recovery() {
  const [admin, setAdmin] = useState(false),
    [items, setItems] = useState([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    meApi().then((u) => setAdmin(u?.roleId === "admin"));
  }, []);
  function inspect(data) {
    const candidates = [];
    for (const [kind, key] of [
      ["patients", "deltaVetPatients"],
      ["clients", "deltaVetClients"],
      ["procedures", "deltaVetProcedures"],
    ]) {
      let records = data[key] ?? data[kind] ?? [];
      if (typeof records === "string") records = JSON.parse(records);
      if (!Array.isArray(records)) continue;
      for (const payload of records) {
        if (!payload || typeof payload !== "object") continue;
        const key = identity(payload);
        const exists = read(keys[kind]).some((p) => identity(p) === key);
        candidates.push({ kind, key, payload, exists });
      }
    }
    for (const key of ["deltaVetVeterinarians", "deltaVetSurgeryExtras"]) {
      let value = data[key];
      if (typeof value === "string") value = JSON.parse(value);
      if (Array.isArray(value))
        candidates.push({
          kind: "settings",
          key,
          payload: { value },
          exists: !!read("deltaVetConfirmedSettings", {})[key],
        });
    }
    setItems(candidates);
    setMessage(
      "Comparação pronta. Confira cada atendimento antes de inserir. Nenhum dado foi enviado.",
    );
  }
  async function recover(item) {
    const reason = prompt(
      "Descreva a origem do backup e por que este registro precisa ser recuperado (mínimo 8 caracteres):",
    );
    if (
      !reason ||
      reason.trim().length < 8 ||
      !confirm(
        "Conferiu que não existe o mesmo atendimento com outro ID? Confirmar inserção individual?",
      )
    )
      return;
    setBusy(true);
    try {
      await sendCommand({
        op: "recover",
        kind: item.kind,
        key: item.key,
        expectedRevision: 0,
        payload: item.payload,
        reason: reason.trim(),
      });
      await refreshConfirmed();
      setItems((xs) =>
        xs.map((x) => (x === item ? { ...x, exists: true } : x)),
      );
      setMessage(
        "Recuperação individual confirmada. Nenhum registro existente foi sobrescrito.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <h1>RECUPERAÇÃO ASSISTIDA</h1>
          <p>
            Comparação e inclusão individual, sem sobrescrever registros atuais.
          </p>
        </div>
        <a href="/master">Voltar</a>
      </header>
      {!admin ? (
        <p>Acesso exclusivo do Administrador.</p>
      ) : (
        <section className="cms-form-card">
          <button
            onClick={() => {
              try {
                inspect(
                  Object.fromEntries(
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith("deltaVet"))
                      .map((k) => [k, localStorage.getItem(k)]),
                  ),
                );
              } catch (e) {
                setMessage(e.message);
              }
            }}
          >
            ANALISAR DADOS ANTIGOS DESTE APARELHO
          </button>
          <label>
            Ou carregar backup JSON{" "}
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (f) inspect(JSON.parse(await f.text()));
                } catch (err) {
                  setMessage("Arquivo inválido: " + err.message);
                }
              }}
            />
          </label>
          <p>{message}</p>
          <p>
            Tombstones bloqueiam a recuperação do mesmo ID. Revise a origem e
            não apague a marca de exclusão. Dados de outro ID podem corresponder
            ao mesmo atendimento: a comparação por ID não substitui essa
            conferência.
          </p>
          {items.map((item, i) => (
            <details key={i}>
              <summary>
                {item.kind} —{" "}
                {item.payload.patientName || item.payload.name || item.key} —
                Ficha {item.payload.number ?? "—"} —{" "}
                {item.exists ? "Já existe: preservado" : "Candidato ausente"}
              </summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(item.payload, null, 2)}
              </pre>
              <button
                disabled={busy || item.exists}
                onClick={() => recover(item)}
              >
                RECUPERAR ESTE REGISTRO
              </button>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
