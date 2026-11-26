"use client";

import {
  saveSetting,
  sendCommand,
  read,
  confirmedAction,
  refreshConfirmed,
} from "../../components/confirmedStore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_EXTRAS = ["Já castrada", "Cio", "Piometra", "Prenhez"];

function readArray(key, fallback = []) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || "null");
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [items, setItems] = useState(DEFAULT_EXTRAS);
  const [newItem, setNewItem] = useState("");
  const [vets, setVets] = useState([]);
  const [newVet, setNewVet] = useState("");
  const [initialNumber, setInitialNumber] = useState("1");
  const [saved, setSaved] = useState("");
  const [revision, setRevision] = useState(0);
  const [settingRevisions, setSettingRevisions] = useState({});

  useEffect(() => {
    const savedExtras = readArray(
      "deltaVetConfirmedSurgeryExtras",
      DEFAULT_EXTRAS,
    );
    setItems(savedExtras.length ? savedExtras : DEFAULT_EXTRAS);
    setVets(readArray("deltaVetConfirmedVeterinarians", []));
    setSettingRevisions(read("deltaVetConfirmedSettings", {}));
    refreshConfirmed()
      .then((d) => {
        setRevision(d.sequenceRevision);
        setInitialNumber(String(d.nextPatientNumber));
        setSettingRevisions(d.settings || {});
        setVets(d.settings?.deltaVetVeterinarians?.value || []);
        setItems(d.settings?.deltaVetSurgeryExtras?.value || DEFAULT_EXTRAS);
      })
      .catch((e) => setSaved(e.message));
    const number = sessionStorage.getItem("deltaVetConfirmedNextPatientNumber");
    if (number) setInitialNumber(number);
  }, []);

  async function persist(key, next, setter) {
    const legacyKey = key.replace("deltaVetConfirmed", "deltaVet");
    const result = await confirmedAction(() =>
      saveSetting(legacyKey, next, settingRevisions[legacyKey]?.revision || 0),
    );
    if (result) {
      setter(next);
      setSettingRevisions(read("deltaVetConfirmedSettings", {}));
    }
  }

  function addExtra() {
    const value = newItem.trim();
    if (!value || items.some((i) => i.toLowerCase() === value.toLowerCase()))
      return;
    persist("deltaVetConfirmedSurgeryExtras", [...items, value], setItems);
    setNewItem("");
  }

  function addVet() {
    const value = newVet.trim();
    if (!value || vets.some((i) => i.toLowerCase() === value.toLowerCase()))
      return;
    persist("deltaVetConfirmedVeterinarians", [...vets, value], setVets);
    setNewVet("");
  }

  async function saveInitialNumber() {
    try {
      const data = await sendCommand({
        op: "configure",
        expectedRevision: revision,
        nextPatientNumber: Number(initialNumber),
      });
      setRevision(data.sequenceRevision);
      setSaved("Numeração confirmada no Neon.");
    } catch (e) {
      setSaved(e.message);
    }
  }

  return (
    <main className="config-screen">
      <section className="config-card">
        <button className="back-arrow" onClick={() => router.push("/master")}>
          ←
        </button>
        <h1>CONFIGURAÇÕES</h1>

        <div className="config-section">
          <h2>Numeração da ficha</h2>
          <div className="config-inline">
            <input
              type="number"
              min="1"
              value={initialNumber}
              onChange={(e) => setInitialNumber(e.target.value)}
            />
            <button onClick={saveInitialNumber}>SALVAR</button>
          </div>
          {saved && <div className="config-saved">{saved}</div>}
        </div>

        <div className="config-section">
          <h2>Veterinários</h2>
          <div className="config-inline">
            <input
              value={newVet}
              onChange={(e) => setNewVet(e.target.value)}
              placeholder="Ex.: Dra. Maria"
              onKeyDown={(e) => e.key === "Enter" && addVet()}
            />
            <button onClick={addVet}>ADICIONAR</button>
          </div>
          <div className="config-items">
            {vets.map((v) => (
              <div className="config-item" key={v}>
                <span>{v}</span>
                <button
                  onClick={() =>
                    persist(
                      "deltaVetConfirmedVeterinarians",
                      vets.filter((x) => x !== v),
                      setVets,
                    )
                  }
                >
                  Excluir
                </button>
              </div>
            ))}
            {!vets.length && (
              <div className="config-empty">Nenhum veterinário cadastrado.</div>
            )}
          </div>
        </div>

        <div className="config-section">
          <h2>Adicionais da confirmação cirúrgica</h2>
          <div className="config-inline">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Novo adicional..."
              onKeyDown={(e) => e.key === "Enter" && addExtra()}
            />
            <button onClick={addExtra}>ADICIONAR</button>
          </div>
          <div className="config-items">
            {items.map((item) => (
              <div className="config-item" key={item}>
                <span>{item}</span>
                <button
                  onClick={() =>
                    persist(
                      "deltaVetConfirmedSurgeryExtras",
                      items.filter((x) => x !== item),
                      setItems,
                    )
                  }
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
