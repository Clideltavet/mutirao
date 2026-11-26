"use client";

import {
  saveRecord,
  deleteRecord,
  refreshConfirmed,
  confirmedAction,
} from "../../../../components/confirmedStore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClientModal from "../../../../components/ClientModal";
import {
  buildClientsFromPatients,
  readClients,
  saveClients,
} from "../../../../components/clientUtils";
import { auditAction } from "../../../../components/auditUtils";
import {
  clientRecordKey,
  queueSyncDelete,
} from "../../../../components/syncUtils";

function readPatients() {
  try {
    const value = JSON.parse(
      sessionStorage.getItem("deltaVetConfirmedPatients") || "[]",
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    let current = readClients();

    setClients(current);
    setPatients(readPatients());
    const refresh = () => {
      setClients(readClients());
      setPatients(readPatients());
    };
    window.addEventListener("deltaVetRemoteSync", refresh);
    return () => window.removeEventListener("deltaVetRemoteSync", refresh);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clients
      .filter((client) => {
        if (!q) return true;
        return `${client.name} ${client.phone} ${client.cpf} ${client.email}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "pt-BR",
        );
      });
  }, [clients, query]);

  async function saveClient(client) {
    await saveRecord("clients", client, client);
    await refreshConfirmed();
    setClients(readClients());
    setEditing(null);
    setShowModal(false);
  }
  async function archiveClient(client) {
    if (!window.confirm("Arquivar o tutor mantendo o histórico?")) return;
    if (
      await confirmedAction(() =>
        saveRecord("clients", client, { ...client, archived: true }),
      )
    ) {
      await refreshConfirmed();
      setClients(readClients());
    }
  }
  async function reactivateClient(client) {
    if (
      await confirmedAction(() =>
        saveRecord("clients", client, { ...client, archived: false }),
      )
    ) {
      await refreshConfirmed();
      setClients(readClients());
    }
  }
  async function removeClient(client) {
    if (
      !window.confirm(
        "Excluir somente este cadastro? O histórico dos animais será preservado.",
      )
    )
      return;
    if (
      await confirmedAction(() =>
        deleteRecord(
          "clients",
          client,
          "Exclusão de cadastro confirmada no CMS",
        ),
      )
    ) {
      setClients(readClients());
    }
  }

  function countAnimals(client) {
    return patients.filter(
      (patient) =>
        patient.clientId === client.id ||
        (!patient.clientId &&
          patient.tutorName?.trim().toLowerCase() ===
            client.name.trim().toLowerCase()),
    ).length;
  }

  return (
    <main className="cms-screen">
      <header className="cms-topbar">
        <div>
          <span className="cms-kicker">CADASTROS</span>
          <h1>CLIENTES / TUTORES</h1>
          <p>
            Cadastre, pesquise e edite os dados dos responsáveis pelos animais.
          </p>
        </div>

        <button
          className="cms-exit-button"
          onClick={() => router.push("/master/cadastros")}
        >
          ← VOLTAR
        </button>
      </header>

      <section className="cms-form-card">
        <div className="clients-toolbar">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone, CPF ou e-mail..."
          />

          <button
            className="cms-primary-button"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
          >
            + NOVO CLIENTE
          </button>
        </div>

        <div className="clients-table-wrap">
          <table className="cms-table clients-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>CPF</th>
                <th>E-mail</th>
                <th>Animais</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                      {client.archived && (
                        <span className="client-archived-badge">ARQUIVADO</span>
                      )}
                    </td>
                    <td>{client.phone || "-"}</td>
                    <td>{client.cpf || "-"}</td>
                    <td>{client.email || "-"}</td>
                    <td>{countAnimals(client)}</td>
                    <td>
                      <div className="client-row-actions">
                        {!client.archived && (
                          <button
                            className="client-edit-button"
                            onClick={() => {
                              setEditing(client);
                              setShowModal(true);
                            }}
                          >
                            EDITAR
                          </button>
                        )}

                        {client.archived ? (
                          <button
                            className="client-reactivate-button"
                            onClick={() => reactivateClient(client)}
                          >
                            REATIVAR
                          </button>
                        ) : countAnimals(client) > 0 ? (
                          <button
                            className="client-archive-button"
                            onClick={() => archiveClient(client)}
                          >
                            ARQUIVAR
                          </button>
                        ) : null}

                        <button
                          className="client-delete-button"
                          onClick={() => removeClient(client)}
                        >
                          {countAnimals(client) > 0
                            ? "EXCLUIR CADASTRO"
                            : "EXCLUIR"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="cms-empty">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showModal && (
        <ClientModal
          client={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={saveClient}
        />
      )}
    </main>
  );
}
