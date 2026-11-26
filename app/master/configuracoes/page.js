"use client";

import { sendCommand } from "../../../components/confirmedStore";
import { acceptSequence } from "../../../components/sequenceState";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SyncStatus from "../../../components/SyncStatus";

export default function Page() {
  const router = useRouter();
  const [nextNumber, setNextNumber] = useState("1");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadSequence() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/settings/sequence", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || "Não foi possível carregar a numeração do Neon.",
          );
        }

        if (!active) return;

        const number = Math.max(1, Number(data.nextPatientNumber) || 1);
        setNextNumber(String(number));
        setRevision(data.sequenceRevision);
        acceptSequence(data);

        // Mantém o cache local alinhado para a tela Entrada deste mesmo aparelho.
        sessionStorage.setItem(
          "deltaVetConfirmedNextPatientNumber",
          String(number),
        );
        sessionStorage.setItem(
          "deltaVetConfirmedSequenceRevision",
          String(Math.max(0, Number(data.revision) || 0)),
        );
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSequence();
    return () => {
      active = false;
    };
  }, []);

  async function saveNumber() {
    const n = Math.max(1, Math.floor(Number(nextNumber) || 1));

    setSaving(true);
    setMsg("");
    setError("");

    try {
      const data = await sendCommand({
        op: "configure",
        expectedRevision: revision,
        nextPatientNumber: n,
      });
      setRevision(data.sequenceRevision);
      acceptSequence(data);
      setNextNumber(String(data.nextPatientNumber));
      setMsg(
        `Sequência salva no Neon. A próxima ficha será ${String(n).padStart(3, "0")}.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">PAINEL CMS • NEON</span>
          <h1>CONFIGURAÇÕES</h1>
          <p>
            Configurações compartilhadas entre computador, tablet e demais
            dispositivos.
          </p>
        </div>

        <div className="cms-config-header-actions">
          <SyncStatus compact />
          <button
            className="cms-exit-button"
            onClick={() => router.push("/master")}
          >
            ← VOLTAR
          </button>
        </div>
      </header>

      <section className="cms-form-card cms-settings-stack">
        <div className="cms-settings-section">
          <div className="sequence-setting-title">
            <div>
              <h2>Numeração sequencial das fichas</h2>
              <p>
                Informe exatamente qual número deverá aparecer na próxima
                Entrada. Essa configuração é salva no Neon e vale para todos os
                aparelhos.
              </p>
            </div>

            <div className="sequence-preview-card">
              <small>PRÓXIMA FICHA</small>
              <strong>
                {String(Math.max(1, Number(nextNumber) || 1)).padStart(3, "0")}
              </strong>
            </div>
          </div>

          <label className="cms-setting-field sequence-number-field">
            <span>Próximo número</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              disabled={loading || saving}
              value={nextNumber}
              onChange={(e) =>
                setNextNumber(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
            />
            <small>
              Exemplo: se colocar 150, a próxima entrada será a ficha 150 e
              depois seguirá 151, 152, 153...
            </small>
          </label>

          <div className="sequence-warning">
            Reiniciar em 001 inicia uma nova sequência. Fichas antigas mantêm
            seus números e identidades.
          </div>

          <button
            className="cms-primary-button sequence-save-button"
            disabled={loading || saving}
            onClick={saveNumber}
          >
            {saving
              ? "SALVANDO NO NEON..."
              : loading
                ? "CARREGANDO..."
                : "SALVAR SEQUÊNCIA NO NEON"}
          </button>
        </div>

        <button
          className="cms-primary-button"
          onClick={async () => {
            try {
              const r = await fetch("/api/tv/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              if (!r.ok) throw new Error("Pareamento não confirmado.");
              setMsg(
                "TV pareada neste navegador por 90 dias. Encerre a sessão administrativa e abra /cirurgia.",
              );
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          AUTORIZAR ESTE NAVEGADOR COMO TV
        </button>
        <div className="cms-info-note">
          Para alterar a senha de um funcionário ou do administrador, use
          <strong> Cadastros → Funcionários / Acessos → SENHA</strong>.
        </div>

        {msg && <div className="cms-success">{msg}</div>}
        {error && <div className="cms-settings-error">{error}</div>}
      </section>
    </main>
  );
}
