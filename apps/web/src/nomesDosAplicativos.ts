// O nome de cada aplicativo do nads: o título da aba (" — Nilma") e o nome nas rotas (rotas.tsx). Fica à parte porque o
// vite.config.ts também usa: o index.html de cada site já sai com o título dele (Vitor, 28/10/2026: "quando eu entro no
// nads, carrega rapidamente um tal de Concilia aí" — o index.html de todos os sites dizia "Concilia aí" até o app abrir).
export const NOMES_DOS_APLICATIVOS: Record<string, string> = {
  componentes: 'Componentes',
  conversor: 'Conversor',
  mandei: 'Mandei',
  cliente: 'Área do Cliente',
  admin: 'Admin',
  robos: 'Central dos robôs',
  tarefas: 'Tarefas',
};

/** O título da aba do aplicativo (sem aplicativo, só "Nilma"). O Tarefas é só "NADS" (Vitor, 06/11/2026: "Troca o nome da aba, por NADS"). */
export const tituloDoAplicativo = (id: string) => id === 'tarefas' ? 'NADS' : (NOMES_DOS_APLICATIVOS[id] ? NOMES_DOS_APLICATIVOS[id] + ' — Nilma' : 'Nilma');
