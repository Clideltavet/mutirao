console.error(
  "Inicialização bloqueada nesta entrega: não use db:init em banco existente. Consulte docs/BACKUP-IMPLANTACAO.md e execute apenas a migração incremental após backup verificado. Nenhuma senha será alterada.",
);
process.exitCode = 1;
