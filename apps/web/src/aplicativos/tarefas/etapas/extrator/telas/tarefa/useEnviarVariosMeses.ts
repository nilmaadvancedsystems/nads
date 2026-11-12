// "Enviar vários meses" (Vitor, 12/11/2026: "uma popup para eu upar vários arquivos de uma vez e ele separar pelos meses"): os
// extratos de vários meses de um banco de uma vez. Lê cada arquivo, mostra de que mês ele é (com o aviso do de outro banco, do
// mês fora do período da Tarefa e do mês que já tem extrato) e, ao confirmar, cada um entra no seu mês, igual ao enviar de um
// mês só (e vai para o Drive). ViewModel da JanelaVariosMeses.
import { empresas, extrator as x, tarefas } from '@nads/core';
import { useState } from 'react';

export interface ContaDoEnvio { id: string; nome: string; marca?: string }

export interface ArquivoDoEnvio {
  chave: string;
  arquivo: File;
  /** os meses do arquivo ('aaaa-mm'): os das datas dos lançamentos ou os do "sem movimento" */
  meses: string[];
  /** o arquivo não diz o mês (o sem movimento sem data): a pessoa escolhe */
  escolherMes: boolean;
  marcado: boolean;
  /** não entra de jeito nenhum (não é extrato, não leu) */
  bloqueado: boolean;
  avisos: { texto: string; tom: 'erro' | 'aviso' }[];
}

interface Estado { conta: ContaDoEnvio; arquivos: ArquivoDoEnvio[]; lendo: number; enviando: boolean }

const nomeDoBanco = (id?: string) => empresas.BANCOS_CONHECIDOS.find(b => b.id === id)?.nome || id || '';

/**
 * periodo: os meses da Tarefa; jaTem(conta, mes): o mês já tem o extrato; enviar(conta, arquivo, meses): o mesmo do enviar de
 * um mês (importa; deu certo, manda para o Drive) e devolve se entrou.
 */
export function useEnviarVariosMeses(periodo: string[], jaTem: (conta: string, mes: string) => boolean,
  enviar: (conta: string, arquivo: File, meses: string[]) => Promise<boolean>) {
  const [e, setE] = useState<Estado | null>(null);
  const mm = tarefas.rotuloNumericoCompetencia;

  function avisosDe(conta: ContaDoEnvio, meses: string[]): ArquivoDoEnvio['avisos'] {
    const fora = meses.filter(m => !periodo.includes(m));
    const comExtrato = meses.filter(m => periodo.includes(m) && jaTem(conta.id, m));
    return [
      ...(fora.length ? [{ texto: (fora.length === 1 ? 'Mês fora' : 'Meses fora') + ' do período da Tarefa: ' + fora.map(mm).join(', '), tom: 'aviso' as const }] : []),
      ...(comExtrato.length ? [{ texto: 'Já tem extrato em ' + comExtrato.map(mm).join(', ') + ' (vai perguntar se sobrepõe)', tom: 'aviso' as const }] : []),
    ];
  }

  async function ler(conta: ContaDoEnvio, f: File): Promise<ArquivoDoEnvio> {
    const chave = f.name + '|' + f.size + '|' + f.lastModified;
    const lido = await x.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'banco');
    const base = { chave, arquivo: f, escolherMes: false };
    if (x.deOutroBanco(lido.bancoNoTexto, conta.marca)) {
      return { ...base, meses: [], marcado: false, bloqueado: true, avisos: [{ texto: 'É o extrato do ' + nomeDoBanco(lido.bancoNoTexto) + ', não do ' + nomeDoBanco(conta.marca) + '.', tom: 'erro' }] };
    }
    if (lido.semMovimento) {
      const meses = [...lido.semMovimento].sort();
      if (!meses.length) return { ...base, meses: [], escolherMes: true, marcado: false, bloqueado: false, avisos: [{ texto: 'Sem movimento, e o extrato não diz o mês: escolha o mês', tom: 'aviso' }] };
      return { ...base, meses, marcado: meses.every(m => periodo.includes(m)), bloqueado: false, avisos: [{ texto: 'Sem movimento', tom: 'aviso' }, ...avisosDe(conta, meses)] };
    }
    if (lido.erro || lido.faturaDeCartao || lido.naoEExtrato || !lido.lancamentos.length) {
      return { ...base, meses: [], marcado: false, bloqueado: true, avisos: [{ texto: lido.erro || (lido.faturaDeCartao ? 'É fatura de cartão' : 'Nenhum lançamento'), tom: 'erro' }] };
    }
    const meses = [...new Set(lido.lancamentos.map(l => l.data.slice(0, 7)))].sort();
    // o mês fora do período fica desmarcado (a pessoa marca se quiser)
    return { ...base, meses, marcado: meses.some(m => periodo.includes(m)), bloqueado: false, avisos: avisosDe(conta, meses) };
  }

  async function acrescentar(fs: FileList | File[]) {
    const conta = e?.conta;
    if (!conta) return;
    const novos = Array.from(fs).filter(f => !e.arquivos.some(a => a.arquivo.name === f.name && a.arquivo.size === f.size && a.arquivo.lastModified === f.lastModified));
    if (!novos.length) return;
    setE(v => (v ? { ...v, lendo: v.lendo + novos.length } : v));
    for (const f of novos) {
      const a = await ler(conta, f);
      setE(v => (v && v.conta.id === conta.id ? { ...v, lendo: v.lendo - 1, arquivos: [...v.arquivos, a].sort((p, q) => (p.meses[0] || '9').localeCompare(q.meses[0] || '9')) } : v));
    }
  }

  const mudar = (chave: string, f: (a: ArquivoDoEnvio) => ArquivoDoEnvio) =>
    setE(v => (v ? { ...v, arquivos: v.arquivos.map(a => (a.chave === chave ? f(a) : a)) } : v));

  const prontos = (e?.arquivos || []).filter(a => a.marcado && !a.bloqueado && a.meses.length);

  async function confirmar() {
    if (!e || !prontos.length || e.enviando) return;
    setE(v => (v ? { ...v, enviando: true } : v));
    const conta = e.conta.id;
    // um arquivo depois do outro: cada um pergunta o seu "sobrepor" e manda o seu pedaço para o Drive
    for (const a of prontos) {
      const ok = await enviar(conta, a.arquivo, a.meses);
      setE(v => (v ? { ...v, arquivos: ok ? v.arquivos.filter(b => b.chave !== a.chave) : v.arquivos } : v));
    }
    setE(v => (v && !v.arquivos.some(a => a.marcado && !a.bloqueado) ? null : v ? { ...v, enviando: false } : v));
  }

  return {
    aberta: e,
    periodo,
    prontos: prontos.length,
    abrir: (conta: ContaDoEnvio) => setE({ conta, arquivos: [], lendo: 0, enviando: false }),
    fechar: () => setE(v => (v?.enviando ? v : null)),
    acrescentar,
    marcar: (chave: string) => mudar(chave, a => (a.bloqueado || !a.meses.length ? a : { ...a, marcado: !a.marcado })),
    escolherMes: (chave: string, mes: string) => {
      const conta = e?.conta;
      if (conta) mudar(chave, a => ({ ...a, meses: [mes], marcado: true, avisos: [{ texto: 'Sem movimento', tom: 'aviso' }, ...avisosDe(conta, [mes])] }));
    },
    tirar: (chave: string) => setE(v => (v ? { ...v, arquivos: v.arquivos.filter(a => a.chave !== chave) } : v)),
    confirmar,
  };
}

export type VmVariosMeses = ReturnType<typeof useEnviarVariosMeses>;
