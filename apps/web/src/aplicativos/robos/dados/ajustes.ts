// O repositório das configurações da Central dos robôs (10/11/2026): os ajustes (os MESMOS documentos config/* que o robô já
// lê), os horários, os alertas e quem pode o quê. Esta é a versão de exemplo, na memória: nada vai para o banco, nenhum aviso
// sai. A do banco está em ajustes.firestore.ts.
import { robos as r, usuarios } from '@nads/core';

export type ValoresDoGrupo = Record<string, r.ValorDeAjuste>;
export interface PessoaDaEquipe { uid: string; nome: string; email: string; admin: boolean }
export interface MinhaIdentidade { nome: string; admin: boolean }

export interface RepoAjustes {
  exemplos: boolean;
  minhaPermissao(eu: MinhaIdentidade): Promise<r.PermissaoNaCentral>;
  lerAjustes(): Promise<Record<string, ValoresDoGrupo>>;
  /** Grava só o que mudou, em cima do documento que já existe (o resto do documento não é tocado). */
  gravarAjuste(g: r.GrupoDeAjustes, antes: ValoresDoGrupo, agora: ValoresDoGrupo, por: string): Promise<void>;
  lerHorarios(): Promise<Record<string, r.HorarioDoRobo>>;
  gravarHorario(robo: string, h: r.HorarioDoRobo, por: string): Promise<void>;
  lerAlertas(): Promise<r.AlertasDosRobos>;
  gravarAlertas(a: r.AlertasDosRobos, por: string): Promise<void>;
  pessoas(): Promise<PessoaDaEquipe[]>;
  lerPermissoes(): Promise<Record<string, r.PermissaoNaCentral>>;
  /** Sem acesso (papel vazio) apaga o documento da pessoa. */
  gravarPermissao(uid: string, p: r.PermissaoNaCentral, por: string): Promise<void>;
}

/** Ao vivo no navegador: as mesmas regras que a tela usa valem aqui, para o erro aparecer nos exemplos também. */
function conferirGrupo(g: r.GrupoDeAjustes, antes: ValoresDoGrupo, agora: ValoresDoGrupo) {
  return r.gravacaoDoAjuste(g, r.mudancasDoGrupo(g, antes, agora));
}

const PESSOAS: PessoaDaEquipe[] = usuarios.EQUIPE_EXEMPLO.map(u => ({ uid: 'ex-' + u.nome, nome: u.nome, email: u.nome.toLowerCase() + '@exemplo.com', admin: u.papeis.includes('admin') }));

export function criarAjustesMemoria(pessoasDeExemplo: PessoaDaEquipe[] = PESSOAS): RepoAjustes {
  const ajustes: Record<string, ValoresDoGrupo> = Object.fromEntries(r.AJUSTES.map(g => [g.doc, r.lerValores(g, g.doc === 'roboIgnorados' ? { remetentes: ['marketing@exemplo.com'] } : g.doc === 'cobranca' ? { regua: { ligada: false, dias: [5, 15] }, diaLimite: 10 } : null)]));
  let horarios = r.lerHorarios(null);
  let alertas = r.lerAlertas(null);
  const permissoes: Record<string, r.PermissaoNaCentral> = {
    'ex-Vitor': { admin: false, papel: 'administrar', robos: [] },
    'ex-Heverton': { admin: false, papel: 'ver', robos: [] },
    'ex-Clara': { admin: false, papel: 'comandar', robos: ['fgts', 'sieg'] },
  };
  return {
    exemplos: true,
    async minhaPermissao(eu) {
      if (eu.admin) return r.TODA_PERMISSAO;
      const pessoa = pessoasDeExemplo.find(p => p.nome === eu.nome);
      return (pessoa && permissoes[pessoa.uid]) || r.SEM_PERMISSAO;
    },
    lerAjustes: async () => structuredClone(ajustes),
    async gravarAjuste(g, antes, agora) { conferirGrupo(g, antes, agora); ajustes[g.doc] = { ...agora }; },
    lerHorarios: async () => structuredClone(horarios),
    async gravarHorario(robo, h) {
      const qual = r.ROBOS_COM_HORARIO.find(x => x.id === robo);
      const erro = qual ? r.validarHorario(qual, h) : 'Este robô não aceita horário.';
      if (erro) throw new Error(erro);
      horarios = { ...horarios, [robo]: h };
    },
    lerAlertas: async () => structuredClone(alertas),
    async gravarAlertas(a) { const erro = r.validarAlertas(a); if (erro) throw new Error(erro); alertas = structuredClone(a); },
    pessoas: async () => pessoasDeExemplo.map(p => ({ ...p })),
    lerPermissoes: async () => structuredClone(permissoes),
    async gravarPermissao(uid, p) {
      const erro = r.validarPermissao(p);
      if (erro) throw new Error(erro);
      if (p.papel) permissoes[uid] = { admin: false, papel: p.papel, robos: p.papel === 'comandar' ? [...p.robos] : [] };
      else delete permissoes[uid];
    },
  };
}
