// "Enviar vários meses" (Vitor, 12/11/2026: "uma popup para eu upar vários arquivos de uma vez e ele separar pelos meses"): os
// extratos de vários meses de um banco de uma vez. Lê cada arquivo, mostra de que mês ele é pelo extrato (as datas dos
// lançamentos lidos, nunca o nome do arquivo: "identificando pelo extrato"; o de vários meses ou sem o mês, a pessoa escolhe) (com o aviso do de outro banco, do
// mês fora do período da Tarefa e do mês que já tem extrato) e, ao confirmar, cada um entra no seu mês, igual ao enviar de um
// mês só (e vai para o Drive). ViewModel da JanelaVariosMeses.
// naHora (a novidade 'importar-ao-soltar'; Vitor, 16/11/2026: "Ja importe com todos marcados"): sem o Enviar, o marcado entra
// assim que é lido; a lista vira o resumo do que entrou, e desmarcar ou o X desfaz. O mês fora do período fica desmarcado e
// não entra (o período à risca): a pessoa marca se quiser.
import { empresas, extrator as x, tarefas } from '@nads/core';
import { useRef, useState } from 'react';

export interface ContaDoEnvio { id: string; nome: string; marca?: string }

export interface ArquivoDoEnvio {
  chave: string;
  arquivo: File;
  /** os meses em que o arquivo vai entrar ('aaaa-mm'): de início, todos os do arquivo */
  meses: string[];
  /** os meses do extrato: os das datas dos lançamentos ou os do "sem movimento" */
  doArquivo: string[];
  /** a pessoa escolhe o mês: o extrato de vários meses (todos ou um só) ou o sem movimento que não diz o mês */
  escolherMes: boolean;
  marcado: boolean;
  /** não entra de jeito nenhum (não é extrato, não leu) */
  bloqueado: boolean;
  avisos: { texto: string; tom: 'erro' | 'aviso' }[];
  /** o extrato sem movimento (entra marcando o mês; desfazer desmarca) */
  semMovimento?: boolean;
  /** naHora: já entrou (marcado e importado) / está entrando */
  entrou?: boolean;
  entrando?: boolean;
  /** o arquivo do ⚡ Dados de teste (não vai para o Drive) */
  deTeste?: boolean;
}

interface Estado { conta: ContaDoEnvio; arquivos: ArquivoDoEnvio[]; lendo: number; enviando: boolean }

const nomeDoBanco = (id?: string) => empresas.BANCOS_CONHECIDOS.find(b => b.id === id)?.nome || id || '';

/** escolheu menos meses do que o extrato tem: só os lançamentos deles */
const soOsMeses = (a: ArquivoDoEnvio) => a.doArquivo.length > 1 && a.meses.length < a.doArquivo.length;

/**
 * periodo: os meses da Tarefa; jaTem(conta, mes): o mês já tem o extrato; enviar(conta, arquivo, meses): o mesmo do enviar de
 * um mês (importa; deu certo, manda para o Drive) e devolve se entrou; desfazer(conta, arquivo): tira o que entrou (pergunta
 * antes) e devolve se tirou; naHora: importa ao soltar.
 */
export function useEnviarVariosMeses(periodo: string[], jaTem: (conta: string, mes: string) => boolean,
  enviar: (conta: string, arquivo: File, meses: string[], soOsMeses: boolean, deTeste: boolean) => Promise<boolean>,
  desfazer: (conta: string, a: ArquivoDoEnvio) => Promise<boolean>, naHora: boolean) {
  const [e, setE] = useState<Estado | null>(null);
  const mm = tarefas.rotuloNumericoCompetencia;
  // a fila e as funções de agora: o que entra depois de outro usa o estado de depois (o "sobrepor" vê o que acabou de entrar)
  const fila = useRef<Promise<void>>(Promise.resolve());
  const atual = useRef({ enviar, desfazer });
  atual.current = { enviar, desfazer };

  function avisosDe(conta: ContaDoEnvio, meses: string[]): ArquivoDoEnvio['avisos'] {
    const fora = meses.filter(m => !periodo.includes(m));
    const comExtrato = meses.filter(m => periodo.includes(m) && jaTem(conta.id, m));
    return [
      ...(fora.length ? [{ texto: (fora.length === 1 ? 'Mês fora' : 'Meses fora') + ' do período da Tarefa: ' + fora.map(mm).join(', '), tom: 'aviso' as const }] : []),
      ...(comExtrato.length ? [{ texto: (naHora ? 'Já tinha extrato em ' : 'Já tem extrato em ') + comExtrato.map(mm).join(', ') + (naHora ? ' (pergunta se sobrepõe)' : ' (vai perguntar se sobrepõe)'), tom: 'aviso' as const }] : []),
    ];
  }

  async function ler(conta: ContaDoEnvio, f: File, deTeste: boolean): Promise<ArquivoDoEnvio> {
    const chave = f.name + '|' + f.size + '|' + f.lastModified;
    const lido = await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'banco');
    const base = { chave, arquivo: f, escolherMes: false, doArquivo: [] as string[], ...(deTeste ? { deTeste } : {}) };
    if (x.deOutroBanco(lido.bancoNoTexto, conta.marca)) {
      return { ...base, meses: [], marcado: false, bloqueado: true, avisos: [{ texto: 'É o extrato do ' + nomeDoBanco(lido.bancoNoTexto) + ', não do ' + nomeDoBanco(conta.marca) + '.', tom: 'erro' }] };
    }
    if (lido.semMovimento) {
      const meses = [...lido.semMovimento].sort();
      if (!meses.length) return { ...base, semMovimento: true, meses: [], escolherMes: true, marcado: false, bloqueado: false, avisos: [{ texto: 'Sem movimento, e o extrato não diz o mês: escolha o mês', tom: 'aviso' }] };
      return { ...base, semMovimento: true, meses, doArquivo: meses, marcado: meses.every(m => periodo.includes(m)), bloqueado: false, avisos: [{ texto: 'Sem movimento', tom: 'aviso' }, ...avisosDe(conta, meses)] };
    }
    if (lido.erro || lido.faturaDeCartao || lido.naoEExtrato || !lido.lancamentos.length) {
      return { ...base, meses: [], marcado: false, bloqueado: true, avisos: [{ texto: lido.erro || (lido.faturaDeCartao ? 'É fatura de cartão' : 'Nenhum lançamento'), tom: 'erro' }] };
    }
    const meses = [...new Set(lido.lancamentos.map(l => l.data.slice(0, 7)))].sort();
    // o mês fora do período fica desmarcado (a pessoa marca se quiser); o de vários meses entra em todos, ou no que ela escolher
    const doPeriodo = meses.filter(m => periodo.includes(m));
    const entra = meses.length > 1 && doPeriodo.length ? doPeriodo : meses;
    return { ...base, meses: entra, doArquivo: meses, escolherMes: meses.length > 1, marcado: doPeriodo.length > 0, bloqueado: false,
      avisos: [...(meses.length > 1 ? [{ texto: 'O extrato tem ' + meses.length + ' meses: ' + meses.map(mm).join(', '), tom: 'aviso' as const }] : []), ...avisosDe(conta, entra)] };
  }

  const mudar = (chave: string, f: (a: ArquivoDoEnvio) => ArquivoDoEnvio) =>
    setE(v => (v ? { ...v, arquivos: v.arquivos.map(a => (a.chave === chave ? f(a) : a)) } : v));

  /** naHora: entra (um depois do outro: cada um pergunta o seu "sobrepor" e manda o seu pedaço para o Drive) */
  function entrar(conta: string, a: ArquivoDoEnvio) {
    mudar(a.chave, b => ({ ...b, marcado: true, entrando: true }));
    fila.current = fila.current.then(async () => {
      const ok = await atual.current.enviar(conta, a.arquivo, a.meses, soOsMeses(a), !!a.deTeste).catch(() => false);
      mudar(a.chave, b => ({ ...b, entrando: false, entrou: ok, marcado: ok }));
    });
  }

  /** naHora: desmarcar (fica na lista, para escolher o mês de novo) ou o X (sai da lista) */
  async function tirarOQueEntrou(chave: string, daLista: boolean) {
    const a = e?.arquivos.find(b => b.chave === chave);
    if (!e || !a || a.entrando) return;
    if (a.entrou && !(await atual.current.desfazer(e.conta.id, a))) return;
    setE(v => (v ? { ...v, arquivos: daLista ? v.arquivos.filter(b => b.chave !== chave) : v.arquivos.map(b => (b.chave === chave ? { ...b, entrou: false, marcado: false } : b)) } : v));
  }

  async function acrescentar(fs: FileList | File[], deTeste = false) {
    const conta = e?.conta;
    if (!conta) return;
    const novos = Array.from(fs).filter(f => !e.arquivos.some(a => a.arquivo.name === f.name && a.arquivo.size === f.size && a.arquivo.lastModified === f.lastModified));
    if (!novos.length) return;
    setE(v => (v ? { ...v, lendo: v.lendo + novos.length } : v));
    for (const f of novos) {
      const a = await ler(conta, f, deTeste);
      setE(v => (v && v.conta.id === conta.id ? { ...v, lendo: v.lendo - 1, arquivos: [...v.arquivos, a].sort((p, q) => (p.meses[0] || '9').localeCompare(q.meses[0] || '9')) } : v));
      if (naHora && a.marcado && !a.bloqueado && a.meses.length) entrar(conta.id, a);
    }
  }

  const prontos = (e?.arquivos || []).filter(a => a.marcado && !a.bloqueado && a.meses.length);

  async function confirmar() {
    if (!e || !prontos.length || e.enviando) return;
    setE(v => (v ? { ...v, enviando: true } : v));
    const conta = e.conta.id;
    // um arquivo depois do outro: cada um pergunta o seu "sobrepor" e manda o seu pedaço para o Drive
    for (const a of prontos) {
      const ok = await enviar(conta, a.arquivo, a.meses, soOsMeses(a), !!a.deTeste);
      setE(v => (v ? { ...v, arquivos: ok ? v.arquivos.filter(b => b.chave !== a.chave) : v.arquivos } : v));
    }
    setE(v => (v && !v.arquivos.some(a => a.marcado && !a.bloqueado) ? null : v ? { ...v, enviando: false } : v));
  }

  const entrando = (e?.arquivos || []).some(a => a.entrando);
  return {
    aberta: e,
    periodo,
    naHora,
    prontos: prontos.length,
    /** naHora: quantos entraram, quem está entrando e os meses do período ainda sem extrato (o aviso do mês faltando) */
    entraram: (e?.arquivos || []).filter(a => a.entrou).length,
    entrando,
    faltam: e ? periodo.filter(m => !jaTem(e.conta.id, m)) : [],
    abrir: (conta: ContaDoEnvio) => setE({ conta, arquivos: [], lendo: 0, enviando: false }),
    // naHora: lendo ou entrando, a janela não fecha (o que está na fila entra até o fim)
    fechar: () => setE(v => (v?.enviando || (naHora && (v?.lendo || v?.arquivos.some(a => a.entrando))) ? v : null)),
    acrescentar,
    marcar: (chave: string) => {
      const a = e?.arquivos.find(b => b.chave === chave);
      if (!e || !a || a.bloqueado || !a.meses.length || a.entrando) return;
      if (!naHora) mudar(chave, b => ({ ...b, marcado: !b.marcado }));
      else if (a.entrou) void tirarOQueEntrou(chave, false);
      else entrar(e.conta.id, a);
    },
    /** meses: um só, ou todos os do extrato (naHora: e já entra) */
    escolherMes: (chave: string, meses: string[]) => {
      const conta = e?.conta;
      const a = e?.arquivos.find(b => b.chave === chave);
      if (!conta || !a || a.entrou || a.entrando) return;
      const novo = { ...a, meses, marcado: true, avisos: [
        ...(a.doArquivo.length > 1 ? [{ texto: 'O extrato tem ' + a.doArquivo.length + ' meses: ' + a.doArquivo.map(mm).join(', '), tom: 'aviso' as const }] : [{ texto: 'Sem movimento', tom: 'aviso' as const }]),
        ...avisosDe(conta, meses)] };
      mudar(chave, () => novo);
      if (naHora) entrar(conta.id, novo);
    },
    tirar: (chave: string) => {
      if (naHora) void tirarOQueEntrou(chave, true);
      else setE(v => (v ? { ...v, arquivos: v.arquivos.filter(a => a.chave !== chave) } : v));
    },
    confirmar,
  };
}

export type VmVariosMeses = ReturnType<typeof useEnviarVariosMeses>;
