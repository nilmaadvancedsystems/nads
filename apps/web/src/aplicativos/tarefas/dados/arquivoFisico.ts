// O arquivo físico do escritório (19/11/2026): as caixas, com os envelopes dentro (core arquivoFisico). Interface + a versão
// de exemplo (na memória, com caixas de empresas de mentira); a do banco é arquivoFisico.firestore.ts.
import { arquivoFisico as af } from '@nads/core';

export interface CaixasCarregadas {
  carregada: boolean;
  /** a leitura falhou (sem permissão, sem rede): a tela avisa */
  erro: string;
  lista: readonly af.Caixa[];
}

/** A mudança numa caixa: recebe a caixa como está no banco e devolve a nova (ou o problema, e nada é gravado). */
export type MudancaNaCaixa = (atual: af.Caixa) => { caixa: af.Caixa; problema: string };

export interface RepoArquivoFisico {
  readonly exemplos: boolean;
  /** as caixas: pedir a primeira vez lê do banco (uma vez; não fica ouvindo) */
  caixas(): CaixasCarregadas;
  /** lê de novo (o botão de atualizar) */
  recarregar(): void;
  /** cria a caixa; devolve o problema ('' quando deu certo; uma caixa com o mesmo id já existe, por exemplo) */
  criar(c: af.Caixa): Promise<string>;
  /** muda a caixa a partir do que está no banco agora (dois mexendo juntos não se apagam); devolve o problema ou '' */
  mudar(id: string, mudanca: MudancaNaCaixa): Promise<string>;
  /** apaga a caixa vazia (a criada por engano); devolve o problema ou '' */
  excluir(id: string): Promise<string>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** A parte comum das duas versões: a lista na memória, os ouvintes e as contas sobre ela. */
export function listaDeCaixas() {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let estado: CaixasCarregadas = { carregada: false, erro: '', lista: [] };
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  return {
    estado: () => estado,
    definir(e: CaixasCarregadas) { estado = e; mudou(); },
    /** põe (ou troca) a caixa na lista */
    por(c: af.Caixa) { estado = { ...estado, lista: [...estado.lista.filter(x => x.id !== c.id), c] }; mudou(); },
    tirar(id: string) { estado = { ...estado, lista: estado.lista.filter(x => x.id !== id) }; mudou(); },
    achar: (id: string) => estado.lista.find(x => x.id === id) || null,
    assinar(f: () => void) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}

/** A caixa vazia pode ser apagada; a com envelope, não (tira os envelopes antes). */
export const problemaParaExcluir = (c: af.Caixa | null) => (!c ? 'A caixa não existe mais.' : c.envelopes.length ? 'A caixa tem envelopes: tire os envelopes antes de apagar.' : af.retiradaAberta(c.retiradas) ? 'A caixa está retirada.' : '');

// ---------------------------------------------------------------------------------------------------------------------
// os exemplos
// ---------------------------------------------------------------------------------------------------------------------
const EMPRESAS_DE_EXEMPLO: readonly [number, string, string][] = [
  [565, 'COMÉRCIO EXEMPLO LTDA', 'PJ'], [292, 'INDÚSTRIA EXEMPLO S/A', 'PJ'], [62, 'FAZENDA EXEMPLO', 'PF'], [141, 'TRANSPORTES EXEMPLO LTDA', 'PJ'],
];

function exemplos(): af.Caixa[] {
  const agora = new Date().toISOString();
  const caixas: af.Caixa[] = [];
  const meses = (ano: number, de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => ano + '-' + String(de + i).padStart(2, '0'));
  EMPRESAS_DE_EXEMPLO.forEach(([codigo, nome, pj], i) => {
    for (const ano of [2026, 2025, 2019]) {
      const departamento: af.Departamento = i === 3 && ano === 2025 ? 'Pessoal' : 'Fiscal';
      const base = af.montarCaixa({
        codigo, nome, tipo: pj + '-' + af.letraDoDepartamento(departamento), departamento, ano, numero: 1, arquivadaEm: ano === 2026 ? '2026-11-19' : ano + '-12-20',
        local: af.rotuloDoLugar({ prateleira: i + 1, fileira: ano === 2026 ? 1 : ano === 2025 ? 2 : 6 }), observacoes: '',
      }, 'exemplo', agora);
      let c = af.adicionarEnvelopes(base, meses(ano, 1, ano === 2026 ? 10 : 12), departamento, '', 'exemplo', agora).caixa;
      if (ano === 2026 && i === 0) c = af.adicionarEnvelopes(c, ['2026-03'], departamento, 'Notas de entrada', 'exemplo', agora).caixa;
      if (ano === 2026 && i === 1) c = af.retirar(c, { envelope: c.envelopes[2].id }, 'Clara (exemplo)', 'Conferir notas', new Date(Date.now() - 4 * 86_400_000).toISOString()).caixa;
      if (ano === 2025 && i === 2) c = af.retirar(c, { envelope: null }, 'Vitor (exemplo)', 'Fiscalização', new Date(Date.now() - 12 * 86_400_000).toISOString()).caixa;
      caixas.push(c);
    }
  });
  return caixas;
}

export function criarArquivoFisicoMemoria(quem: () => string): RepoArquivoFisico {
  const l = listaDeCaixas();
  const garantir = () => { if (!l.estado().carregada) l.definir({ carregada: true, erro: '', lista: exemplos() }); };
  return {
    exemplos: true,
    caixas() { garantir(); return l.estado(); },
    recarregar() { /* nos exemplos, nada muda por fora */ },
    async criar(c) {
      garantir();
      if (l.achar(c.id)) return 'Essa caixa já existe.';
      l.por({ ...c, atualizadaPor: c.atualizadaPor || quem() });
      return '';
    },
    async mudar(id, mudanca) {
      garantir();
      const atual = l.achar(id);
      if (!atual) return 'A caixa não existe mais.';
      const r = mudanca(atual);
      if (r.problema) return r.problema;
      l.por(r.caixa);
      return '';
    },
    async excluir(id) {
      const p = problemaParaExcluir(l.achar(id));
      if (p) return p;
      l.tirar(id);
      return '';
    },
    assinar: l.assinar,
    versao: l.versao,
  };
}
