// ViewModel do Ajuste de saldo negativo: arquivo do saldo diário, contas, convenção C/D,
// gerar os lançamentos e montar os arquivos para baixar.
// Origem: cheque_especial.html handleFile (~L465), updateGenerateEnabled (~L512), clique do
// generateBtn (~L650), renderResults (~L688) e downloadLancamentos (~L781).
import { chequeEspecial as ce, type empresas } from '@nads/core';
import { useState } from 'react';

export interface AvisoAjuste { titulo: string; texto: string }

type StatusArquivo = 'lendo' | 'erro' | 'ok';

export interface ResultadoTela {
  dias: ce.DiaSaldo[];
  res: ce.ResultadoAjuste;
  resumo: ce.ResumoAjuste;
  /** data do estorno projetado (próximo dia útil), quando o período termina negativo */
  dataProjetada: string | null;
}

function tamanho(n: number): string {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

export function useAjuste(empresa: Pick<empresas.EmpresaDoEscritorio, 'nome' | 'codigo'>) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [status, setStatus] = useState<StatusArquivo>('ok');
  const [linhas, setLinhas] = useState<unknown[][] | null>(null);
  const [aviso, setAviso] = useState<AvisoAjuste | null>(null);
  const [contaBanco, setContaBanco] = useState('');
  const [contaCheque, setContaCheque] = useState('');
  const [historico, setHistorico] = useState(ce.HISTORICO_PADRAO);
  const [inverterCD, setInverterCD] = useState(true);
  const [resultado, setResultado] = useState<ResultadoTela | null>(null);

  async function escolherArquivo(f: File | null) {
    setAviso(null);
    setResultado(null);
    if (!f) { setArquivo(null); setLinhas(null); return; }
    if (!ce.extensaoValida(f.name)) {
      setAviso({ titulo: 'Formato inválido', texto: 'Envie um arquivo no formato .csv, .xls ou .xlsx.' });
      return;
    }
    setArquivo(f);
    setLinhas(null);
    setStatus('lendo');
    try {
      const l = ce.lerPlanilhaCheque(await f.arrayBuffer());
      setLinhas(l);
      setStatus('ok');
    } catch (e) {
      setStatus('erro');
      setAviso({ titulo: 'Não foi possível ler o arquivo', texto: e instanceof Error && e.message ? e.message : 'Verifique se o arquivo não está corrompido e tente novamente.' });
    }
  }

  const podeGerar = !!(linhas && linhas.length && contaBanco.trim() && contaCheque.trim() && historico.trim());

  function gerar() {
    setAviso(null);
    if (!linhas) return;
    const cols = ce.acharColunas(linhas);
    if (!cols) {
      setResultado(null);
      setAviso({ titulo: 'Colunas não encontradas', texto: 'Não encontrei as colunas Data e Saldo nas primeiras linhas da planilha. Confira se o relatório enviado é o export original do sistema.' });
      return;
    }
    const dias = ce.saldosDeFechamento(linhas, cols, inverterCD);
    if (!dias.length) {
      setResultado(null);
      setAviso({ titulo: 'Nenhum dado válido', texto: 'Não encontrei linhas com data e saldo válidos abaixo do cabeçalho.' });
      return;
    }
    const res = ce.gerarLancamentos(dias, contaBanco.trim(), contaCheque.trim(), historico.trim());
    setResultado({
      dias, res, resumo: ce.resumoDoAjuste(res, dias),
      dataProjetada: res.projetado ? ce.dataBR(ce.proximoDiaUtil(dias[dias.length - 1].data)) : null,
    });
  }

  function arquivoParaBaixar(formato: 'xlsx' | 'xls') {
    if (!resultado) return null;
    return {
      bytes: ce.planilhaDeLancamentos(resultado.res.lancamentos, formato),
      nome: ce.nomeArquivoLancamentos(formato, empresa.codigo != null ? String(empresa.codigo) : undefined),
      tipo: formato === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel',
    };
  }

  const infoArquivo = !arquivo ? '' : status === 'lendo' ? 'Lendo arquivo…' : status === 'erro' ? 'Não foi possível ler este arquivo'
    : tamanho(arquivo.size) + ' · ' + (linhas ? linhas.length : 0) + ' linhas';

  return {
    arquivo, infoArquivo, escolherArquivo, aceitar: ce.EXTENSOES_CHEQUE.join(','),
    contaBanco, setContaBanco, contaCheque, setContaCheque, historico, setHistorico,
    inverterCD, alternarInverterCD: () => setInverterCD(v => !v),
    aviso, fecharAviso: () => setAviso(null),
    podeGerar, gerar, resultado, arquivoParaBaixar,
  };
}
