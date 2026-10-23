// ViewModel de Financeiro › Importar extrato (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um
// importador de extrato que vai trazer os dados e informações para o dashboard inicial"): o banco (Sicoob ou Efí, os
// dois que o escritório usa: "deixe uma opção, já que no escritório só é usado o banco Efí e Sicoob"), o extrato escolhido (PDF, OFX, planilha ou foto), lido pelo Extrator (extrator.lerArquivo); a
// prévia (o período, as entradas, as saídas, o saldo final e quantas linhas já estavam importadas) e Importar, que grava
// à parte do Caixa (financeiroBanco). Embaixo, as importações feitas, cada uma com Desfazer. O arquivo não é guardado.
import { extrator, financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useCaixa } from '../../dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

/** os bancos do escritório (23/10/2026) */
export type BancoDoEscritorio = 'Sicoob' | 'Efí';
export const BANCOS_DO_ESCRITORIO: { valor: BancoDoEscritorio; rotulo: string }[] = [{ valor: 'Sicoob', rotulo: 'Sicoob' }, { valor: 'Efí', rotulo: 'Efí' }];
const ehDoEscritorio = (b: string | undefined): b is BancoDoEscritorio => b === 'Sicoob' || b === 'Efí';

interface Lido { nome: string; id: string; lancamentos: extrator.Lancamento[]; saldoAnterior?: number; saldosDoDia?: { data: string; saldo: number }[]; ocr: boolean; erro: string | null }

export function useImportarExtrato() {
  const repo = useCaixa();
  const extrato = repo.extrato();
  const importacoes = repo.importacoes();
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const operador = useOperador().operador?.nome || '';
  const [bancoEscolhido, setBanco] = useState<BancoDoEscritorio | null>(null);
  // o banco começa no da última importação (ou no Sicoob)
  const ultimo = importacoes.lista[0]?.banco;
  const banco: BancoDoEscritorio = bancoEscolhido ?? (ehDoEscritorio(ultimo) ? ultimo : 'Sicoob');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<Lido | null>(null);
  const [gravando, setGravando] = useState(false);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  async function escolher(f: File | null) {
    setArquivo(f);
    setLido(null);
    if (!f) return;
    setLendo(true);
    const id = 'i_' + Date.now().toString(36);
    try {
      const r = await extrator.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'banco');
      setLido({ nome: f.name, id, lancamentos: r.lancamentos, saldoAnterior: r.saldoAnterior, saldosDoDia: r.saldosDoDia, ocr: !!r.ocr, erro: r.erro });
    } catch (e) {
      setLido({ nome: f.name, id, lancamentos: [], ocr: false, erro: 'Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : String(e)) });
    } finally { setLendo(false); }
  }

  const nomeDoBanco = banco;
  const linhas = useMemo(() => (lido ? financeiro.linhasDoExtrato(lido.lancamentos, nomeDoBanco, lido.id) : []), [lido, nomeDoBanco]);
  const ja = useMemo(() => new Set(extrato.lista.map(x => x.id)), [extrato.lista]);
  const repetidas = linhas.filter(l => ja.has(l.id)).length;
  const resumo = financeiro.resumoDoExtrato(linhas);
  const saldoFinal = lido ? financeiro.saldoFinalDoExtrato(lido.lancamentos, lido.saldoAnterior, lido.saldosDoDia) : undefined;

  return {
    carregando: !extrato.carregada || !importacoes.carregada,
    exemplos: repo.exemplos,
    erroDoBanco: extrato.erro || importacoes.erro,
    banco, setBanco, bancos: BANCOS_DO_ESCRITORIO,
    arquivo, escolher, lendo,
    erro: lido?.erro || '',
    ocr: !!lido?.ocr,
    /** a prévia do extrato lido (null antes de escolher ou quando não veio nenhuma linha) */
    previa: lido && linhas.length ? {
      arquivo: lido.nome,
      periodo: extrator.dataBR(resumo.de) + ' a ' + extrator.dataBR(resumo.ate),
      quantas: linhas.length, novas: linhas.length - repetidas, repetidas,
      entradas: formatos.reais(resumo.entradas), saidas: formatos.reais(resumo.saidas),
      saldoFinal: saldoFinal == null ? null : formatos.reais(saldoFinal),
      linhas: linhas.slice(0, 300).map(l => ({ id: l.id, data: extrator.dataBR(l.data), historico: l.historico, valor: formatos.reais(l.valor), entrada: l.tipo === 'E', ja: ja.has(l.id) })),
      mais: Math.max(0, linhas.length - 300),
    } : null,
    gravando,
    async importar() {
      if (!lido || !linhas.length) return;
      setGravando(true);
      try {
        const r = await repo.importarExtrato({ id: lido.id, banco: nomeDoBanco, arquivo: lido.nome, ...resumo, saldoFinal }, linhas, operador);
        toast(r.novas ? r.novas + (r.novas === 1 ? ' lançamento importado' : ' lançamentos importados') + (r.repetidas ? ' (' + r.repetidas + ' já estavam)' : '') + '.' : 'Nada novo: todas as linhas já estavam importadas.');
        setArquivo(null);
        setLido(null);
      } catch (e) { toast('Não importei: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setGravando(false); }
    },
    cancelar() { setArquivo(null); setLido(null); },
    /** as importações feitas, da mais nova para a mais velha */
    importacoes: importacoes.lista.map(i => ({
      id: i.id, banco: i.banco, arquivo: i.arquivo,
      periodo: i.de ? extrator.dataBR(i.de) + ' a ' + extrator.dataBR(i.ate) : '—',
      quantos: i.quantos, entradas: formatos.reais(i.entradas), saidas: formatos.reais(i.saidas),
      quando: i.importadoEm ? new Date(i.importadoEm).toLocaleDateString('pt-BR') : '', quem: i.importadoPor,
    })),
    /** o primeiro clique pede a confirmação; o segundo desfaz */
    desfazendo,
    async desfazer(id: string) {
      if (desfazendo !== id) { setDesfazendo(id); return; }
      try { await repo.desfazerImportacao(id); toast('Importação desfeita.'); }
      catch (e) { toast('Não desfiz: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setDesfazendo(null); }
    },
    verNoPainel: () => navegar(caminhoDaPagina('financeiro', 'painel')),
  };
}
