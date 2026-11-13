// O mural de avisos do escritório, no Início da Tarefas (27/10/2026: "informações do escritorio como avisos"): o admin e o
// diretor escrevem, fixam e apagam; toda a equipe lê. Interface + a versão de exemplo (na memória); a do banco é
// avisos.firestore.ts (coleção nadsAvisos do Entregas).
import { tarefas as t } from '@nads/core';

export interface RepoAvisos {
  exemplos: boolean;
  /** os avisos, ao vivo (carregados: já chegou do banco, ou falhou) */
  lista(): { carregados: boolean; avisos: t.AvisoDoEscritorio[] };
  /** extras: o comunicado do Início novo (o tipo, o título, o link e o dia da reunião; 13/11/2026) */
  /** porUid: o login de quem escreveu (quem escreveu sempre vê o aviso e vê quem marcou o Recebido) */
  publicar(texto: string, por: string, extras?: t.ExtrasDoComunicado, porUid?: string): Promise<void>;
  /** o Recebido de quem leu o aviso que pede confirmação (13/11/2026) */
  marcarRecebido(id: string, quem: { uid: string; nome: string }): Promise<void>;
  fixar(id: string, fixado: boolean): Promise<void>;
  apagar(id: string): Promise<void>;
  assinar(f: () => void): () => void;
  versao(): number;
}

/** completo: o ⚡ do Início (o modo desenvolvedor) também traz uma reunião, um estudo e um comunicado */
export function criarAvisosMemoria(completo = false): RepoAvisos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const ha = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const diaEHora = (dias: number, hora: string) => t.delegadas.hojeIso(new Date(Date.now() + dias * 86400_000)) + 'T' + hora;
  let avisos: t.AvisoDoEscritorio[] = [
    { id: 'av-1', texto: 'Fechamento de outubro: as rotinas do Fiscal até o dia 10.', por: 'Vitor', em: ha(30), fixado: true },
    { id: 'av-2', texto: 'Sexta-feira o escritório fecha às 16h.', por: 'Vitor', em: ha(4) },
    ...(completo ? [
      { id: 'av-3', tipo: 'reuniao' as const, titulo: 'Reunião do fechamento', texto: 'Pauta: o que ficou pendente de outubro e a divisão das empresas novas.', por: 'Nilma', em: ha(6), quando: diaEHora(3, '09:00'), link: 'https://meet.google.com/' },
      { id: 'av-4', tipo: 'estudo' as const, titulo: 'Reforma tributária: o que muda em 2027', texto: 'Leiam antes da reunião: o resumo da Receita sobre a CBS e o IBS.', por: 'Vitor', em: ha(26), link: 'https://www.gov.br/receitafederal/' },
      { id: 'av-5', tipo: 'geral' as const, titulo: 'Novo horário do almoço', texto: 'A partir de segunda, o almoço passa a ser das 11h às 13h.', por: 'Sávio', em: ha(50) },
      { id: 'av-6', tipo: 'reuniao' as const, titulo: 'Treinamento do nads', texto: 'Como usar o Início novo e as Notificações.', por: 'Vitor', em: ha(2), quando: diaEHora(1, '14:00') },
      { id: 'av-7', tipo: 'estudo' as const, titulo: 'eSocial: a nova versão do leiaute', texto: 'O que muda nos eventos de folha a partir do ano que vem. Vale a leitura para o DP.', por: 'Sávio', em: ha(75), link: 'https://www.gov.br/esocial/' },
      { id: 'av-8', tipo: 'aviso' as const, titulo: 'Senha do Wi-Fi trocada', texto: 'A senha nova está colada na recepção.', por: 'Nilma', em: ha(96) },
      { id: 'av-9', tipo: 'reuniao' as const, titulo: 'Alinhamento do Fiscal', texto: 'As apurações de novembro e quem fica com cada empresa.', por: 'Heverton', em: ha(1), quando: diaEHora(7, '10:30'), fixado: true },
      { id: 'av-11', tipo: 'aviso' as const, titulo: 'Novo procedimento das guias', texto: 'A partir de hoje as guias saem só pelo nads. Marquem o Recebido depois de ler.', por: 'Nilma', porUid: 'exemplo-1', em: ha(3), pedeConfirmacao: true, recebidos: [{ uid: 'exemplo-6', nome: 'Clara', em: ha(2) }] },
      { id: 'av-12', tipo: 'aviso' as const, titulo: 'Só para o Fiscal: SPED de outubro', texto: 'O SPED de outubro vai até o dia 20. Avisem se faltar nota.', por: 'Nilma', porUid: 'exemplo-1', em: ha(7), pedeConfirmacao: true, para: { tipo: 'setor' as const, setores: ['fiscal'] } },
      { id: 'av-13', tipo: 'geral' as const, titulo: 'Para o Vitor e a Clara: cliente novo', texto: 'Vocês ficam com o cliente novo a partir de dezembro.', por: 'Nilma', porUid: 'exemplo-1', em: ha(9), para: { tipo: 'pessoas' as const, pessoas: [{ uid: 'exemplo-3', nome: 'Vitor' }, { uid: 'exemplo-6', nome: 'Clara' }] } },
      { id: 'av-10', tipo: 'geral' as const, titulo: 'Confraternização de fim de ano', texto: 'Dia 18 de dezembro, depois do expediente. Confirmem até o dia 10.', por: 'Vitor', em: ha(120) },
    ] : []),
  ];
  return {
    exemplos: true,
    lista: () => ({ carregados: true, avisos }),
    async publicar(texto, por, extras, porUid) {
      if (extras) { const problema = t.problemaDoComunicado(texto, extras); if (problema) throw new Error(problema); }
      avisos = [...avisos, { id: 'av-' + Date.now(), texto: t.limparAviso(texto), por, em: new Date().toISOString(), ...(porUid ? { porUid } : {}), ...(extras ? t.camposDoComunicado(extras) : {}) }];
      mudou();
    },
    async fixar(id, fixado) { avisos = avisos.map(a => (a.id === id ? { ...a, fixado } : a)); mudou(); },
    async marcarRecebido(id, quem) { avisos = avisos.map(a => (a.id === id ? t.comRecebido(a, quem, new Date().toISOString()) : a)); mudou(); },
    async apagar(id) { avisos = avisos.filter(a => a.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
