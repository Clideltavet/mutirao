"use client";

import { updatePatient, read, keys } from "./confirmedStore";
import { useEffect, useState } from "react";
import { auditAction, getCurrentActor } from "./auditUtils";

const DEFAULT_EXTRAS = ["Já castrada", "Cio", "Piometra", "Prenhez"];

function readArray(key, fallback = []) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export default function SurgeryConfirmModal({ patient, onClose, onSaved }) {
  const [veterinarians, setVeterinarians] = useState([]);
  const [extras, setExtras] = useState(DEFAULT_EXTRAS);
  const [vet, setVet] = useState(patient?.veterinarian || "");
  const [selectedExtras, setSelectedExtras] = useState(
    patient?.surgeryExtras || [],
  );
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [surgeryNotes, setSurgeryNotes] = useState(patient?.surgeryNotes || "");

  useEffect(() => {
    setVeterinarians(readArray("deltaVetConfirmedVeterinarians", []));
    const savedExtras = readArray(
      "deltaVetConfirmedSurgeryExtras",
      DEFAULT_EXTRAS,
    );
    setExtras(savedExtras.length ? savedExtras : DEFAULT_EXTRAS);
  }, []);

  if (!patient) return null;

  function toggleExtra(extra) {
    setSelectedExtras((current) =>
      current.includes(extra)
        ? current.filter((item) => item !== extra)
        : [...current, extra],
    );
  }

  function review() {
    setError("");
    setStep(2);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updatePatient(
        patient,
        {
          veterinarian: vet || "",
          surgeryExtras: selectedExtras,
          surgeryNotes: surgeryNotes.trim(),
        },
        "CIRURGIA_CONFIRMADA",
      );
      onSaved?.(read(keys.patients));
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="surgery-modal">
        {step === 1 ? (
          <>
            <h2>INFORMAÇÕES DO ANIMAL</h2>

            <div className="animal-summary">
              <strong>
                Ficha nº {String(patient.number).padStart(3, "0")}
              </strong>
              <span>
                {patient.species} • {patient.sex}
                {patient.weight ? ` • ${patient.weight} kg` : ""}
              </span>
              <span>Tutor: {patient.tutorName || "-"}</span>
              <span>
                Procedimento: {(patient.procedures || []).join(" / ") || "-"}
              </span>
            </div>

            <label className="modal-field">
              <span>
                Veterinário responsável <small>(opcional)</small>
              </span>
              <select value={vet} onChange={(e) => setVet(e.target.value)}>
                <option value="">Selecione...</option>
                {veterinarians.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal-section-title">
              Adicionais / informações cirúrgicas
            </div>
            <div className="extras-grid">
              {extras.map((extra) => (
                <label className="modal-check" key={extra}>
                  <input
                    type="checkbox"
                    checked={selectedExtras.includes(extra)}
                    onChange={() => toggleExtra(extra)}
                  />
                  <span>{extra}</span>
                </label>
              ))}
            </div>

            <label className="modal-field surgery-notes-field">
              <span>Observações sobre o procedimento</span>
              <textarea
                value={surgeryNotes}
                onChange={(e) => setSurgeryNotes(e.target.value)}
                placeholder="Registre alguma informação importante do procedimento..."
              />
            </label>

            {error && <div className="modal-error">{error}</div>}

            <div className="modal-actions">
              <button
                className="modal-secondary"
                type="button"
                onClick={onClose}
              >
                CANCELAR
              </button>
              <button className="modal-primary" type="button" onClick={review}>
                CONFIRMAR
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>CONFIRMAR ALTERAÇÕES</h2>

            <div className="animal-summary">
              <strong>
                Ficha nº {String(patient.number).padStart(3, "0")}
              </strong>
              <span>Veterinário: {vet || "Não informado"}</span>
              <span>
                {selectedExtras.length
                  ? selectedExtras.join(" • ")
                  : "Nenhum adicional marcado"}
              </span>
              <span>Observação: {surgeryNotes.trim() || "Nenhuma"}</span>
            </div>

            {error && <div className="modal-error">{error}</div>}
            <p className="final-question">
              Confirma definitivamente estas informações?
            </p>

            <div className="modal-actions">
              <button
                className="modal-secondary"
                type="button"
                onClick={() => setStep(1)}
              >
                VOLTAR
              </button>
              <button
                className="modal-primary"
                type="button"
                disabled={saving}
                onClick={save}
              >
                CONFIRMAR DEFINITIVO
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
