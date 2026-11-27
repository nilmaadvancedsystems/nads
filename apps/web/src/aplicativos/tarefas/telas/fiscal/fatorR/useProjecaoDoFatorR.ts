// ViewModel da Projeção do Fator R (Fiscal › Ferramentas; 26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal). De cima
// para baixo: (1) na barra, a empresa e o ano da projeção; Subir PDF do PGDAS-D, Exportar Excel e Imprimir; (2) o Fator R
// de hoje (o "banco de dados" da planilha: os 12 meses antes do PA atual) em números; (3) a tabela, um mês por linha, do
// ano anterior ao fim do ano da projeção: a receita e a folha (o PGDAS-D do robô quando há; senão digitadas ou do PDF), o
// fator do mês, a RBT12, a FS12, o Fator R do PA, o Anexo e a folha que falta para 28%.
// Quem usa: o Fiscal e o admin (o dono, 26/11/2026). Grava um documento por empresa e ano (fatorR/{ano}_{código}) ao sair
// do campo. As contas são as do core (tarefas.fatorR).
import { areaCliente, empresas as emp, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useOperador } from '../../../casca/operador';
import { useDadosDaEmpresaNoEntregas, useFatorR, useRepo } from '../../../dados/repo';
import { imprimirHtml } from '../../dp/imprimirHtml';
import { useEmpresasPermitidas } from '../../empresas/andamento';

extrator.definirWorkerDoPdf(workerDoPdf);

const f = t.fatorR;
const DO_SIMPLES = ['Simples'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const competenciaDe = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const brl = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type CampoDoMes = t.fatorR.CampoDoFatorR;

export function useProjecaoDoFatorR() {
  const repo = useRepo();
  const fr = useFatorR();
  const { operador: op } = useOperador();
  const { toast } = useRetorno();
  const pode = !!op && (op.admin || op.departamento === 'fiscal');
  // a empresa aberta em Minhas empresas chega já escolhida, pelo endereço (?empresa=código)
  const [params] = useSearchParams();
  const [codigo, setCodigo] = useState<number | null>(() => Number(params.get('empresa')) || null);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [ano, setAno] = useState(() => f.anoPadraoDaProjecao(new Date()));
  const [lendoPdf, setLendoPdf] = useState(false);
  const [gravando, setGravando] = useState(0);
  // o último problema (gravar, o valor digitado, o PDF); some ao trocar de empresa ou de ano
  const [erro, setErro] = useState('');

  // (1) a empresa: as do Simples primeiro
  const empresas = useEmpresasPermitidas().filtrar(repo.listarEmpresas()).filter(e => e.codigo != null);
  const empresa = codigo != null ? empresas.find(e => e.codigo === codigo) || null : null;
  const regimeDe = (e: { codigo: number | null; regime: string }) => t.regimeDaEmpresa(e.codigo) || e.regime || '';
  const q = busca.trim();
  const achadas = q ? [...emp.buscarEmpresas(empresas, q)].sort((a, b) => Number(!DO_SIMPLES.includes(regimeDe(a))) - Number(!DO_SIMPLES.includes(regimeDe(b)))).slice(0, 8)
    .map(e => ({ ...e, regime: regimeDe(e) })) : [];
  const regime = empresa ? regimeDe(empresa) : '';
  const doEntregas = useDadosDaEmpresaNoEntregas(codigo);
  const cnpj = (doEntregas.dados?.documento || '').replace(/\D/g, '');

  // (2) os documentos dos três anos e o PGDAS-D da empresa (lidos uma vez)
  const anos = f.anosDaProjecao(ano);
  const dados = empresa && pode ? fr.daEmpresa(empresa.codigo as number, anos) : null;
  const meses = useMemo(() => (dados?.carregada ? f.mesesDaEmpresa([...dados.anos.values()], dados.pgdas) : {}), [dados]);
  const competencias = f.competenciasDaProjecao(ano);
  const linhas = useMemo(() => f.linhasDoFatorR(meses, (ano - 1) + '-01', ano + '-12'), [meses, ano]);
  const atual = competenciaDe(new Date());
  const hoje = dados?.carregada && competencias.includes(atual) ? f.fatorRDoPa(meses, atual) : null;
  const comPgdas = !!dados?.pgdas && Object.keys(dados.pgdas.meses).length > 0;

  const gravar = async (docs: readonly t.fatorR.FatorRDoAno[], ok?: string) => {
    setGravando(n => n + 1);
    setErro('');
    try { await fr.salvar(docs); if (ok) toast(ok); }
    catch (e) { setErro('Não deu para gravar: ' + ((e as Error)?.message || 'tente de novo')); }
    finally { setGravando(n => n - 1); }
  };

  const relatorio = () => empresa ? f.relatorioDoFatorR({
    empresa: { codigo: empresa.codigo as number, nome: empresa.nome, cnpj: doEntregas.dados?.documento || '' }, ano, linhas, hoje,
  }) : null;

  return {
    exemplos: fr.exemplos,
    pode,
    // a empresa (a peça EmpresaDaBarra)
    empresa: empresa ? { codigo: empresa.codigo as number, nome: empresa.nome } : null,
    regime,
    foraDoSimples: !!empresa && !!regime && !DO_SIMPLES.includes(regime),
    busca, setBusca: (v: string) => { setBusca(v); setAtivo(0); }, achadas, ativo, setAtivo,
    mover(d: number) { setAtivo(i => Math.max(0, Math.min(achadas.length - 1, i + d))); },
    escolher(e: { codigo: number | null }) { setCodigo(e.codigo); setBusca(''); setErro(''); },
    escolherDestacado() { const e = achadas[ativo]; if (e) { setCodigo(e.codigo); setBusca(''); setErro(''); } },
    trocarEmpresa() { setCodigo(null); setErro(''); },
    // o ano da projeção
    ano,
    anoAnterior: () => { setAno(a => a - 1); setErro(''); },
    anoSeguinte: () => { setAno(a => a + 1); setErro(''); },
    erro, fecharErro: () => setErro(''),
    // a leitura
    carregando: !!dados && !dados.carregada,
    falhou: !!dados?.falhou,
    gravando: gravando > 0,
    comPgdas,
    pgdasConsultadoEm: dados?.pgdasConsultadoEm ? t.pgdas.consultadoEmTexto(dados.pgdasConsultadoEm) : '',
    // o Fator R de hoje e a projeção
    minimo: f.FATOR_R_EM_PCT,
    linhas,
    /** o gráfico: uma barra por PA com o Fator R (sem receita na janela, sem barra) e a escala em % (no mínimo 40%) */
    grafico: {
      barras: linhas.map(l => ({
        competencia: l.competencia, mes: MESES_CURTOS[Number(l.competencia.slice(5)) - 1], ano: l.competencia.slice(0, 4),
        fator: l.fator, anexo: l.anexo, rbt12: l.rbt12, fs12: l.fs12, folhaQueFalta: l.folhaQueFalta, de: l.de, ate: l.ate, folhaDe: l.folhaDe, folhaAte: l.folhaAte, defasagem: l.defasagem,
        incompleto: l.mesesComReceita < 12 || l.mesesComFolha < 12, atual: l.competencia === atual, projecao: l.competencia >= ano + '-01',
      })),
      escala: Math.max(40, Math.ceil((Math.max(0, ...linhas.map(l => l.fator ?? 0)) + 4) / 10) * 10),
    },
    /** o ano da linha: o anterior (o que já passou, em boa parte) ou o da projeção */
    daProjecao: (c: string) => c >= ano + '-01',
    ehMesAtual: (c: string) => c === atual,
    mesAno: f.mesAno,
    rotuloDaFonte: (v: t.fatorR.ValorDoMes | null) => (v ? f.ROTULO_DA_FONTE[v.fonte] : ''),
    /** o número do mês pode ser digitado? (o do PGDAS-D do robô não: é o declarado à Receita) */
    editavel: (v: t.fatorR.ValorDoMes | null) => !v || v.fonte !== 'pgdas',
    dicaDoValor(v: t.fatorR.ValorDoMes | null, campo: CampoDoMes): string {
      if (!v) return campo === 'receita' ? 'Digite a receita bruta do mês.' : 'Digite a folha do mês: salários, pró-labore, FGTS e CPP.';
      if (v.fonte === 'pgdas') return (campo === 'receita' ? 'A receita declarada no PGDAS-D' : 'A folha declarada no PGDAS-D (item 2.3)') + ', que o robô do e-CAC baixou' + (dados?.pgdasConsultadoEm ? ' (' + t.pgdas.consultadoEmTexto(dados.pgdasConsultadoEm) + ')' : '') + '.';
      if (v.fonte === 'pdf') return 'Lido do PDF do extrato do PGDAS-D subido aqui. Digite outro valor para trocar.';
      return 'Digitado. Apague para tirar.';
    },
    /** o que a pessoa digitou no mês (vazio tira o valor) */
    mudar(competencia: string, campo: CampoDoMes, texto: string) {
      if (!dados?.carregada || dados.falhou) return;
      const a = Number(competencia.slice(0, 4));
      const doc = dados.anos.get(a);
      if (!doc) return;
      const limpo = texto.trim();
      const valor = limpo ? formatos.numeroDigitado(limpo) : null;
      if (limpo && (valor == null || valor < 0)) { setErro('Valor não entendido: digite como 1.234,56.'); return; }
      const novo = f.comValorDoMes(doc, competencia, campo, valor);
      if (novo === doc) { setErro('Valor não aceito.'); return; }
      void gravar([novo]);
    },
    // o PDF do extrato do PGDAS-D (para a empresa que o robô ainda não consultou; o PDF não é guardado)
    lendoPdf,
    async subirPdf(arquivo: File | null | undefined) {
      if (!arquivo || !empresa || !dados?.carregada || dados.falhou) return;
      if (!cnpj) { setErro('O nads não tem o CNPJ desta empresa: não dá para conferir o extrato.'); return; }
      setLendoPdf(true);
      try {
        const bytes = new Uint8Array(await arquivo.arrayBuffer());
        const texto = areaCliente.textoDoPdf(await extrator.itensDoPdf(bytes));
        const r = f.comOExtrato(dados.anos, t.pgdas.extratoDoPgdas(texto), { codigo: empresa.codigo as number, cnpj }, anos);
        if ('erro' in r) { setErro(r.erro); return; }
        await gravar(r.docs, 'Extrato de ' + f.mesAno(r.pa) + ': ' + r.receitas + (r.receitas === 1 ? ' mês' : ' meses') + ' de receita'
          + (r.folhas ? ' e ' + r.folhas + (r.folhas === 1 ? ' mês' : ' meses') + ' de folha' : ' (sem a folha: o extrato não trouxe o item 2.3)') + '.');
      } catch (e) {
        setErro('Não deu para ler o PDF: ' + ((e as Error)?.message || 'arquivo com problema'));
      } finally { setLendoPdf(false); }
    },
    // Exportar Excel e Imprimir
    temRelatorio: !!empresa && !!dados?.carregada && !dados.falhou,
    exportar() {
      const rel = relatorio();
      if (!rel) return;
      baixarBytes(f.planilhaDoFatorR(rel), rel.nome + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    },
    imprimir() {
      const rel = relatorio();
      if (!rel) return;
      imprimirHtml(f.htmlDoFatorR(rel, { logo: logoNilmaParaImprimir('colorida'), emitidoEm: new Date() }));
      toast('Projeção pronta: escolha a impressora');
    },
    brl,
  };
}

export type VmProjecaoDoFatorR = ReturnType<typeof useProjecaoDoFatorR>;
