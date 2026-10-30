// O leitor do SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra"; na página SINTEGRA do Fiscal e no item
// "Entradas x SINTEGRA" da rotina): sobe o arquivo, lê pelo core (tarefas.sintegra) e mostra o resumo, o que o validador
// recusaria e as conferências com o SIEG (as notas do "Baixar XMLs") e com o Alterdata (as Entradas e Saídas importadas
// na Conferência, ou os relatórios de Entradas e Saídas que a pessoa sobe aqui mesmo; 29/10/2026). Na rotina, a empresa e o mês vêm da etapa; na página, do próprio arquivo (o CNPJ e o período do
// registro 10). O arquivo não é guardado: fica só na tela.
import { conferencia, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useNotasDaConferencia } from '../../../../concilia-ai/importadosNaEtapa';
import { useGmailDoEntregas, useRepo, useSieg } from '../../../dados/repo';
import { useEmpresasPermitidas } from '../../empresas/andamento';

export type AbaDoSintegra = 'resumo' | 'sieg' | 'alterdata' | 'layout';

/** o CFOP bate com o Alterdata: o mesmo valor e o mesmo número de notas */
const cfopBate = (x: { valorSintegra: number; valorAlterdata: number; notasSintegra: number; notasAlterdata: number }) =>
  !(Math.round((x.valorSintegra - x.valorAlterdata) * 100) / 100) && x.notasSintegra === x.notasAlterdata;

export function useLeitorSintegra(daEtapa?: { codigo: string; competencia: string }) {
  const { toast } = useRetorno();
  const repo = useRepo();
  const sieg = useSieg();
  const gmail = useGmailDoEntregas();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState('');
  const [aba, setAba] = useState<AbaDoSintegra>('resumo');
  // os relatórios do Alterdata subidos aqui (o de Entradas e o de Saídas; ficam só na tela, como o SINTEGRA)
  const [relatorios, setRelatorios] = useState<{ nome: string; notas: conferencia.Nota[] }[]>([]);
  const permitidas = useEmpresasPermitidas();

  const arq = useMemo(() => (texto ? t.sintegra.lerSintegra(texto) : null), [texto]);
  const cab = arq?.cabecalho || null;

  // a empresa e o mês: os da etapa, ou os do registro 10 (o CNPJ casado com o cadastro de clientes do Entregas)
  const clientes = gmail.clientes().lista;
  const codigoDoArquivo = useMemo(() => {
    if (!cab) return '';
    const c = clientes.find(x => (x.documento || '').replace(/\D/g, '') === cab.cnpj);
    return c ? String(c.codigo) : '';
  }, [cab, clientes]);
  const codigo = daEtapa?.codigo || codigoDoArquivo;
  const competencia = daEtapa?.competencia || (cab?.inicio ? cab.inicio.slice(0, 7) : '');
  // a empresa de outra pessoa fica de fora (29/10/2026: "se não é encarregado não deve nem ver")
  const empresa = permitidas.filtrar(repo.listarEmpresas()).find(e => String(e.codigo) === codigo) || null;
  const nome = empresa?.nome || '';

  // o arquivo é de outra empresa ou de outro mês que o da etapa
  const avisos: string[] = [];
  if (cab && daEtapa) {
    if (codigoDoArquivo && codigoDoArquivo !== daEtapa.codigo) avisos.push('O CNPJ do arquivo (' + cab.cnpj + ') é de outra empresa.');
    if (cab.inicio && cab.inicio.slice(0, 7) !== daEtapa.competencia) avisos.push('O arquivo é de ' + t.rotuloCompetencia(cab.inicio.slice(0, 7)) + ', não de ' + t.rotuloCompetencia(daEtapa.competencia) + '.');
  }
  if (cab && !daEtapa && !codigoDoArquivo) avisos.push('O CNPJ do arquivo (' + cab.cnpj + ') não é de nenhum cliente do cadastro: mostro só o resumo e o layout.');

  const resumo = useMemo(() => (arq ? t.sintegra.resumirSintegra(arq) : null), [arq]);

  // o SIEG: só com o "Baixar XMLs do SIEG" feito naquele mês
  const notasSieg = codigo && competencia ? sieg.notas(codigo, competencia) : null;
  const siegDados = notasSieg?.dados || null;
  const comSieg = useMemo(() => (arq && siegDados ? t.sintegra.conferirComSieg(arq, siegDados) : null), [arq, siegDados]);

  // o Alterdata: os relatórios subidos aqui; sem eles, as Entradas e Saídas importadas na Conferência, daquele mês
  const lidas = useNotasDaConferencia(nome);
  const doRelatorio = useMemo(() => t.sintegra.notasDosRelatorios(relatorios.map(r => r.notas), competencia), [relatorios, competencia]);
  const comAlterdata = useMemo(() => {
    if (!arq) return null;
    if (relatorios.length) return t.sintegra.conferirComAlterdata(arq, doRelatorio, []);
    if (!lidas) return null;
    const entradas = lidas.entradas.filter(n => n.comp === competencia), saidas = lidas.saidas.filter(n => n.comp === competencia);
    if (!entradas.length && !saidas.length) return null;
    return t.sintegra.conferirComAlterdata(arq, entradas, saidas);
  }, [arq, lidas, competencia, relatorios.length, doRelatorio]);

  // o número de cada aba (30/10/2026, o visual novo: a aba diz quanto tem para olhar)
  const pendenciasSieg = comSieg ? comSieg.soNoSieg.length + comSieg.soNoSintegra.length + comSieg.valorDiferente.length + comSieg.situacaoDiferente.length : null;
  const pendenciasAlterdata = comAlterdata ? comAlterdata.soNoAlterdata.length + comAlterdata.soNoSintegra.length + comAlterdata.porCfop.filter(x => !cfopBate(x)).length : null;

  return {
    arquivo, arq, cab, resumo, avisos, aba, setAba, naEtapa: !!daEtapa,
    empresa: empresa ? empresa.codigo + ' · ' + empresa.nome : '',
    competencia, rotuloCompetencia: competencia ? t.rotuloCompetencia(competencia) : '',
    comSieg, temSieg: !!siegDados, pendenciasSieg,
    comAlterdata, pendenciasAlterdata,
    /** a comparação por CFOP com o Alterdata, com a diferença e se bate */
    cfopsAlterdata: (comAlterdata?.porCfop || []).map(x => ({ ...x, dif: Math.round((x.valorSintegra - x.valorAlterdata) * 100) / 100, bate: cfopBate(x) })),
    /** os registros do arquivo (10, 11, 50…) com quantas linhas de cada */
    registros: arq ? Object.entries(arq.contagem).sort(([x], [y]) => x.localeCompare(y)).map(([tipo, quantos]) => ({ tipo, quantos })) : [],
    /** de onde vieram as notas do Alterdata: os relatórios subidos aqui ou as importadas na Conferência */
    alterdataDosRelatorios: relatorios.length > 0,
    relatorios: relatorios.map((r, i) => ({ id: String(i), nome: r.nome, detalhe: r.notas.length + (r.notas.length === 1 ? ' nota' : ' notas') })),
    notasDosRelatorios: doRelatorio.length,
    async lerRelatorios(fs: File[]) {
      const novos: { nome: string; notas: conferencia.Nota[] }[] = [];
      for (const f of fs) {
        try {
          const notas = conferencia.lerNotas(conferencia.lerPlanilha(await f.arrayBuffer()));
          if (!notas.length) { toast(f.name + ': não achei nenhuma nota.'); continue; }
          novos.push({ nome: f.name, notas });
        } catch (e) {
          toast(f.name + ': ' + (e instanceof Error ? e.message : String(e)) + ' Use o relatório de Entradas ou de Saídas do Alterdata.');
        }
      }
      if (novos.length) { setRelatorios(r => [...r, ...novos]); setAba('alterdata'); }
    },
    tirarRelatorio: (id: string) => setRelatorios(r => r.filter((_, i) => String(i) !== id)),
    async ler(f: File | null) {
      if (!f) { setTexto(''); setArquivo(null); return; }
      try {
        // o SINTEGRA sai em ISO-8859-1/Windows-1252 (o nome da empresa com acento)
        const buf = await f.arrayBuffer();
        setTexto(new TextDecoder('windows-1252').decode(buf));
        setArquivo(f);
        setAba('resumo');
      } catch (e) {
        toast('Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : String(e)));
      }
    },
  };
}

export type VmLeitorSintegra = ReturnType<typeof useLeitorSintegra>;
