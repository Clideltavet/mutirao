export const DEFAULT_PROCEDURES = [
  { id: "castracao", name: "Castração", value: 0 },
  { id: "cirurgia-geral", name: "Cirurgia Geral", value: 0 },
  { id: "ortopedia", name: "Ortopedia", value: 0 },
  { id: "odontologia", name: "Odontologia", value: 0 },
  { id: "exame", name: "Exame", value: 0 },
  { id: "ambulatorial", name: "Procedimento Ambulatorial", value: 0 },
  { id: "outro", name: "Outro", value: 0 },
];

export function normalizeProcedureCatalog(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          id: `legacy-${index}-${item.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`,
          name: item,
          value: 0,
          _syncUpdatedAt: new Date().toISOString(),
        };
      }

      return {
        ...item,
        id: item.id || `proc-${index}-${Date.now()}`,
        name: String(item.name || "").trim(),
        value: Number(item.value) || 0,
        _syncUpdatedAt:
          item._syncUpdatedAt || item.updatedAt || new Date().toISOString(),
      };
    })
    .filter((item) => item.name);
}

export function readProcedureCatalog() {
  try {
    const raw = JSON.parse(
      sessionStorage.getItem("deltaVetConfirmedProcedures") || "null",
    );
    return normalizeProcedureCatalog(raw);
  } catch {
    return [];
  }
}

export function saveProcedureCatalog() {
  throw new Error("Use saveRecord para gravação individual confirmada.");
}

export function procedureDetailsForNames(
  names,
  catalog = readProcedureCatalog(),
) {
  return (names || []).filter(Boolean).map((name) => {
    const found = catalog.find((item) => item.name === name);
    return {
      name,
      value: Number(found?.value) || 0,
    };
  });
}

export function patientProcedureDetails(
  patient,
  catalog = readProcedureCatalog(),
) {
  if (
    Array.isArray(patient?.procedureDetails) &&
    patient.procedureDetails.length
  ) {
    return patient.procedureDetails
      .map((item) => ({
        name: item.name || "",
        value: Number(item.value) || 0,
      }))
      .filter((item) => item.name);
  }

  return (patient?.procedures || []).map((name) => ({
    name,
    value: 0,
    unknown: true,
  }));
}

export function patientTotalValue(patient, catalog = readProcedureCatalog()) {
  if (
    patient?.totalValue != null &&
    patient.totalValue !== "" &&
    Number.isFinite(Number(patient.totalValue))
  ) {
    return Number(patient.totalValue);
  }
  return patientProcedureDetails(patient, catalog).reduce(
    (sum, item) => sum + (Number(item.value) || 0),
    0,
  );
}

export function currencyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function moneyMask(value = "") {
  const digits = String(value).replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const number = Number(digits) / 100;
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moneyToNumber(value = "") {
  const digits = String(value).replace(/\D/g, "");
  return digits ? Number(digits) / 100 : 0;
}

export function preserveProcedureDetails(names, prior, catalog) {
  return names.map(
    (name) =>
      prior.find((p) => p.name === name) ||
      procedureDetailsForNames([name], catalog)[0],
  );
}

export function financialKnown(p) {
  return (
    (p?.totalValue != null &&
      p.totalValue !== "" &&
      Number.isFinite(Number(p.totalValue))) ||
    (Array.isArray(p?.procedureDetails) &&
      p.procedureDetails.length > 0 &&
      p.procedureDetails.every(
        (x) => x.value != null && Number.isFinite(Number(x.value)),
      )) ||
    (Array.isArray(p?.procedures) && p.procedures.length === 0)
  );
}
export function addMoney(a, b) {
  return (
    (Math.round(Number(a || 0) * 100) + Math.round(Number(b || 0) * 100)) / 100
  );
}
