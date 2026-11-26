"use client";

import { updatePatient, read, keys } from "./confirmedStore";
import { useEffect, useState } from "react";
import { auditAction, getCurrentActor } from "./auditUtils";

function readVets() {
  try {
    const v = JSON.parse(
      sessionStorage.getItem("deltaVetConfirmedVeterinarians") || "[]",
    );
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function DischargeModal({ patient, onClose, onSaved }) {
  const [vets, setVets] = useState([]);
  const [vet, setVet] = useState(
    patient?.dischargeVeterinarian || patient?.veterinarian || "",
  );
  const [notes, setNotes] = useState(patient?.dischargeNotes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setVets(readVets()), []);

  if (!patient) return null;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updatePatient(
        patient,
        { dischargeVeterinarian: vet || "", dischargeNotes: notes.trim() },
        "ALTA",
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
        <h2>LIBERAR ALTA</h2>
        <div className="animal-summary">
          <strong>Ficha nº {String(patient.number).padStart(3, "0")}</strong>
          <span>
            {patient.species} • {patient.sex}
          </span>
          <span>Tutor: {patient.tutorName || "-"}</span>
          <span>
            Procedimento: {(patient.procedures || []).join(" / ") || "-"}
          </span>
          <span>
            Veterinário do procedimento: {patient.veterinarian || "-"}
          </span>
        </div>

        <label className="modal-field">
          <span>Veterinário que autorizou a alta (opcional)</span>
          <select value={vet} onChange={(e) => setVet(e.target.value)}>
            <option value="">Não informar</option>
            {vets.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="modal-field discharge-notes-field">
          <span>Observações da alta</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Digite observações importantes sobre a alta do paciente..."
          />
          <small>
            Estas observações ficarão visíveis para toda a equipe e serão
            lembradas na entrega.
          </small>
        </label>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="modal-secondary" onClick={onClose}>
            CANCELAR
          </button>
          <button className="modal-primary" disabled={saving} onClick={save}>
            LIBERAR ALTA
          </button>
        </div>
      </section>
    </div>
  );
}
