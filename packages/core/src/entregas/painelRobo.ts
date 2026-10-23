// O painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo, arquivando e afins"):
// Tarefas › Cadastro › Painel do robô, só para o admin e o diretor. O que os dois robôs publicam (robo/painel.js):
//   robo/painelPC  o robô do PC do escritório (o arquivador: o arquivamento, o FGTS, o Alterdata, o SIEG, a Área do Cliente)
//   robo/painelVM  o robô da nuvem (o vigia: o Gmail e as cobranças, a NFS-e, a SEFAZ, os envios do nads, os extratos)
//     { robo, nome, maquina, versao, ligadoEm, em (o batimento, a cada minuto), desligadoEm, agora: [{ chave, texto, desde }],
//       modulos: [{ id, nome, ligado, motivo }], filas: [{ id, nome, esperando, andamento, maisAntigoEm, erro }],
//       arquivados (só o PC): { mes, em, hoje, noMes, naoIdentificadosNoMes, execucoesNoMes, execucoes: [...] } }
//   roboAtividade/{id}  { em, robo, maquina, tipo, texto, detalhe, erro } (o robô apaga as de mais de 7 dias)
// e, enquanto um robô ainda não foi atualizado com o painel, o sinal que já existia (robo/arquivador.em no PC;
// robo/estado.vigia.em na nuvem). Aqui só a leitura e as contas; quem lê o banco é o repositório da tela.
import { haQuanto } from './saude';

export type IdRobo = 'pc' | 'vm';
export type TomDoPainel = 'ok' | 'aviso' | 'erro' | 'neutro';

export interface FazendoAgora { chave: string; texto: string; desde: string }
export interface ModuloDoRobo { id: string; nome: string; ligado: boolean; motivo: string }
export interface FilaDoRobo { id: string; nome: string; esperando: number; andamento: number; maisAntigoEm: string; erro: string }
export interface ExecucaoArquivada { id: string; em: string; arquivados: number; clientes: number; naoIdentificados: number }
export interface ArquivadosDoMes {
  mes: string; em: string; hoje: number; noMes: number; naoIdentificadosNoMes: number; execucoesNoMes: number; execucoes: ExecucaoArquivada[];
}
/** O que está HOJE em NÃO IDENTIFICADOS (o arquivador novo conta; 23/10/2026): a mesma conta da aba Para resolver. */
export interface ParaResolverAgora { agora: number; em: string }
export interface BatimentoDoRobo {
  robo: IdRobo; nome: string; maquina: string; versao: string; ligadoEm: string; em: string; desligadoEm: string;
  agora: FazendoAgora[]; modulos: ModuloDoRobo[]; filas: FilaDoRobo[]; arquivados: ArquivadosDoMes | null;
  /** null: o robô ainda não conta (antes de ser atualizado) */
  paraResolver: ParaResolverAgora | null;
}
export interface AtividadeDoRobo { id: string; em: string; robo: IdRobo; maquina: string; tipo: string; texto: string; detalhe: string; erro: boolean }
/** O sinal de vida de antes do painel (para quando o robô ainda não publica o painel). */
export interface SinalAntigo { em: string; maquina: string; desligadoEm: string }

export interface DocsDoPainelRobo {
  carregado: boolean;
  /** a leitura foi negada (quem não é admin nem diretor) */
  semPermissao: boolean;
  pc: BatimentoDoRobo | null;
  vm: BatimentoDoRobo | null;
  sinais: { pc: SinalAntigo | null; vm: SinalAntigo | null };
  atividades: AtividadeDoRobo[];
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const MIN = 60 * 1000;
const HORA = 60 * MIN;
const idade = (iso: string, agora: number) => { const t = Date.parse(iso); return Number.isFinite(t) ? agora - t : Infinity; };

/** O batimento como veio do banco (null sem documento). */
export function lerBatimento(robo: IdRobo, d: Obj | null | undefined): BatimentoDoRobo | null {
  if (!d) return null;
  const a = d.arquivados ? obj(d.arquivados) : null;
  const pr = d.paraResolver ? obj(d.paraResolver) : null;
  return {
    robo, nome: txt(d.nome) || NOMES_DOS_ROBOS[robo], maquina: txt(d.maquina), versao: txt(d.versao), ligadoEm: txt(d.ligadoEm),
    em: txt(d.em), desligadoEm: txt(d.desligadoEm),
    agora: lista(d.agora).map(x => ({ chave: txt(x.chave), texto: txt(x.texto), desde: txt(x.desde) })).filter(x => x.texto),
    modulos: lista(d.modulos).map(x => ({ id: txt(x.id), nome: txt(x.nome), ligado: !!x.ligado, motivo: txt(x.motivo) })),
    filas: lista(d.filas).map(x => ({ id: txt(x.id), nome: txt(x.nome), esperando: num(x.esperando), andamento: num(x.andamento), maisAntigoEm: txt(x.maisAntigoEm), erro: txt(x.erro) })),
    arquivados: a ? {
      mes: txt(a.mes), em: txt(a.em), hoje: num(a.hoje), noMes: num(a.noMes), naoIdentificadosNoMes: num(a.naoIdentificadosNoMes),
      execucoesNoMes: num(a.execucoesNoMes),
      execucoes: lista(a.execucoes).map(x => ({ id: txt(x.id), em: txt(x.em), arquivados: num(x.arquivados), clientes: num(x.clientes), naoIdentificados: num(x.naoIdentificados) })),
    } : null,
    paraResolver: pr ? { agora: num(pr.agora), em: txt(pr.em) } : null,
  };
}

/** Uma linha da atividade como veio do banco. */
export function lerAtividade(id: string, d: Obj): AtividadeDoRobo {
  return { id, em: txt(d.em), robo: d.robo === 'vm' ? 'vm' : 'pc', maquina: txt(d.maquina), tipo: txt(d.tipo) || 'robo', texto: txt(d.texto), detalhe: txt(d.detalhe), erro: d.erro === true };
}

export const NOMES_DOS_ROBOS: Record<IdRobo, string> = { pc: 'Robô do PC', vm: 'Robô da nuvem' };
export const ONDE_RODA: Record<IdRobo, string> = { pc: 'PC do escritório', vm: 'Nuvem do Google' };

/** Os tipos de atividade (o filtro), na ordem do filtro. Os mesmos de robo/painel.js. */
export const TIPOS_DE_ATIVIDADE: readonly { id: string; rotulo: string }[] = [
  { id: 'arquivamento', rotulo: 'Arquivamento' },
  { id: 'fgts', rotulo: 'FGTS' },
  { id: 'alterdata', rotulo: 'Alterdata' },
  { id: 'sieg', rotulo: 'SIEG' },
  { id: 'area-cliente', rotulo: 'Área do Cliente' },
  { id: 'gmail', rotulo: 'Gmail' },
  { id: 'cobranca', rotulo: 'Cobrança' },
  { id: 'envios', rotulo: 'Envios do nads' },
  { id: 'nfse', rotulo: 'NFS-e' },
  { id: 'sefaz', rotulo: 'SEFAZ' },
  { id: 'extratos', rotulo: 'Extratos' },
  { id: 'robo', rotulo: 'Robô' },
];
export const rotuloDoTipo = (tipo: string) => TIPOS_DE_ATIVIDADE.find(t => t.id === tipo)?.rotulo || tipo;

/** "hoje, 09:12", "ontem, 18:02" ou "12/10, 09:10" ('' sem data). */
export function quandoNoPainel(iso: string, agora: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const hoje = new Date(agora);
  const dia = (x: Date) => x.getFullYear() * 10000 + x.getMonth() * 100 + x.getDate();
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  const hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (dia(d) === dia(hoje)) return 'hoje, ' + hora;
  if (dia(d) === dia(ontem)) return 'ontem, ' + hora;
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + ', ' + hora;
}

/** A situação de um robô no cartão. */
export interface SituacaoDoRobo {
  robo: IdRobo;
  nome: string;
  onde: string;
  tom: TomDoPainel;
  /** Ligado, Atrasado, Desligado, Sem painel, Sem informação */
  rotulo: string;
  /** o último sinal: "há 1 min", "agora há pouco", "desligou há 2 h" */
  sinal: string;
  maquina: string;
  versao: string;
  /** "hoje, 07:58" */
  ligadoDesde: string;
  /** o que está fazendo agora; vazio = ocioso */
  agora: { texto: string; ha: string }[];
  /** os módulos que não ligaram, com o motivo */
  desligados: ModuloDoRobo[];
  ligados: number;
  /** o robô ainda não publica o painel: o que fazer */
  aviso: string;
}

/** Ligado até 3 min sem batimento; atrasado até 10 min; depois, desligado. */
export function situacaoDoRobo(robo: IdRobo, b: BatimentoDoRobo | null, sinal: SinalAntigo | null, agora = Date.now()): SituacaoDoRobo {
  const base = { robo, nome: NOMES_DOS_ROBOS[robo], onde: ONDE_RODA[robo], maquina: '', versao: '', ligadoDesde: '', agora: [], desligados: [], ligados: 0, aviso: '' };
  if (!b) {
    if (sinal && sinal.em) {
      const vivo = !sinal.desligadoEm && idade(sinal.em, agora) < 3 * MIN;
      return { ...base, maquina: sinal.maquina, tom: vivo ? 'aviso' : 'erro', rotulo: vivo ? 'Ligado, sem o painel' : 'Desligado',
        sinal: haQuanto(sinal.em, agora) || 'desconhecido',
        aviso: 'Este robô ainda não publica o painel (o que está fazendo, as filas e a atividade). Atualize o código do robô para ver tudo aqui.' };
    }
    return { ...base, tom: 'neutro', rotulo: 'Sem informação', sinal: 'nenhum ainda', aviso: 'O robô ainda não publicou o painel. Ele aparece aqui no primeiro minuto depois de ligado com o código novo.' };
  }
  const dt = idade(b.em, agora);
  const tom: TomDoPainel = b.desligadoEm || dt >= 10 * MIN ? 'erro' : dt >= 3 * MIN ? 'aviso' : 'ok';
  return {
    ...base, maquina: b.maquina, versao: b.versao, ligadoDesde: b.desligadoEm ? '' : quandoNoPainel(b.ligadoEm, agora), tom,
    rotulo: b.desligadoEm ? 'Desligado' : tom === 'ok' ? 'Ligado' : tom === 'aviso' ? 'Atrasado' : 'Sem sinal',
    sinal: b.desligadoEm ? 'desligou ' + (haQuanto(b.desligadoEm, agora) || '') : haQuanto(b.em, agora) || 'desconhecido',
    agora: tom === 'erro' ? [] : b.agora.map(a => ({ texto: a.texto, ha: a.desde ? haQuanto(a.desde, agora) : '' })),
    desligados: b.modulos.filter(m => !m.ligado),
    ligados: b.modulos.filter(m => m.ligado).length,
  };
}

/** Uma linha da tabela das filas. */
export interface LinhaDaFila extends FilaDoRobo { robo: IdRobo; tom: TomDoPainel; espera: string }

/**
 * As filas dos dois robôs numa tabela: primeiro as que têm pedido, depois as vazias. Esperando há mais de 1 hora fica em
 * atenção; com o robô dela desligado e pedido esperando, em erro (ninguém vai atender).
 */
export function filasDoPainel(pc: BatimentoDoRobo | null, vm: BatimentoDoRobo | null, agora = Date.now()): LinhaDaFila[] {
  const linhas: LinhaDaFila[] = [];
  for (const b of [pc, vm]) {
    if (!b) continue;
    const parado = !!b.desligadoEm || idade(b.em, agora) >= 10 * MIN;
    for (const f of b.filas) {
      const tem = f.esperando + f.andamento > 0;
      const velha = f.esperando > 0 && idade(f.maisAntigoEm, agora) >= HORA && Number.isFinite(idade(f.maisAntigoEm, agora));
      const tom: TomDoPainel = f.erro ? 'aviso' : !tem ? 'neutro' : parado && f.esperando > 0 ? 'erro' : velha ? 'aviso' : 'ok';
      linhas.push({ ...f, robo: b.robo, tom, espera: tem && f.maisAntigoEm ? haQuanto(f.maisAntigoEm, agora) : '' });
    }
  }
  return linhas.sort((a, b) => Number(b.esperando + b.andamento > 0) - Number(a.esperando + a.andamento > 0));
}

export interface FiltroDaAtividade { tipo: string; soErros: boolean }

/** A atividade filtrada (tipo 'todos' = todas), a mais nova primeiro. */
export function filtrarAtividades(lista: readonly AtividadeDoRobo[], f: FiltroDaAtividade): AtividadeDoRobo[] {
  return lista.filter(a => (f.tipo === 'todos' || a.tipo === f.tipo) && (!f.soErros || a.erro)).sort((a, b) => b.em.localeCompare(a.em));
}

/** Os tipos que aparecem na atividade (o filtro só mostra os que têm linha), na ordem de TIPOS_DE_ATIVIDADE. */
export function tiposPresentes(lista: readonly AtividadeDoRobo[]): { id: string; rotulo: string; n: number }[] {
  return TIPOS_DE_ATIVIDADE.map(t => ({ ...t, n: lista.filter(a => a.tipo === t.id).length })).filter(t => t.n > 0);
}

/** Os erros das últimas `horas` (24 por padrão), os mais novos primeiro. */
export function errosRecentes(lista: readonly AtividadeDoRobo[], agora = Date.now(), horas = 24): AtividadeDoRobo[] {
  return lista.filter(a => a.erro && idade(a.em, agora) < horas * HORA).sort((a, b) => b.em.localeCompare(a.em));
}
