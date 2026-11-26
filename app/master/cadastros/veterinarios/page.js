"use client";

import {
  saveSetting,
  read,
  confirmedAction,
} from "../../../../components/confirmedStore";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULTS = [];

export default function Page() {
  const router = useRouter();
  const [items, setItems] = useState(DEFAULTS);
  const [value, setValue] = useState("");

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => {
      const v = read("deltaVetConfirmedSettings", {})["deltaVetVeterinarians"];
      setItems(v?.value || DEFAULTS);
      setRevision(v?.revision || 0);
    };
    refresh();
    window.addEventListener("deltaVetRemoteSync", refresh);
    return () => window.removeEventListener("deltaVetRemoteSync", refresh);
  }, []);
  async function save(next) {
    const result = await confirmedAction(() =>
      saveSetting("deltaVetVeterinarians", next, revision),
    );
    if (result) {
      setItems(next);
      setRevision(result.record._revision);
    }
    return !!result;
  }
  async function add() {
    const v = value.trim();
    if (!v || items.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    if (await save([...items, v])) setValue("");
  }
  async function remove(item) {
    await save(items.filter((x) => x !== item));
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>VETERINÁRIOS</h1>
          <p>Lista usada na cirurgia e na liberação de alta.</p>
        </div>
        <button
          className="cms-exit-button"
          onClick={() => router.push("/master/cadastros")}
        >
          ← VOLTAR
        </button>
      </header>

      <section className="cms-form-card">
        <div className="cms-add-row">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex.: Dra. Bruna"
          />
          <button onClick={add}>ADICIONAR</button>
        </div>

        <div className="cms-list">
          {items.length ? (
            items.map((item) => (
              <div className="cms-list-item" key={item}>
                <span>{item}</span>
                <button onClick={() => remove(item)}>EXCLUIR</button>
              </div>
            ))
          ) : (
            <div className="cms-empty">Nenhum cadastro.</div>
          )}
        </div>
      </section>
    </main>
  );
}
