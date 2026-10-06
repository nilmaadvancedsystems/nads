// ViewModel da etapa Arquivo do Conversor: escolher o extrato (PDF, OFX, Excel ou CSV), o resumo do que foi lido e
// o banco (o nome da aba e do arquivo .xls; vem do extrato e a pessoa pode trocar).
import { conversor as cv, extrator } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export function useArquivo() {
  const s = useSessao();
  const { extrato, banco, lendo } = s.estado;
  const linhas = extrato?.linhas || [];
  const ok = !!extrato && !extrato.erro && linhas.length > 0;
  const entradas = linhas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0);
  const saidas = linhas.filter(l => l.valor < 0).reduce((t, l) => t + l.valor, 0);
  const datas = linhas.map(l => l.data).sort();
  return {
    lendo,
    ok,
    arquivo: extrato?.arquivo || '',
    erro: extrato?.erro || null,
    generico: ok && extrato?.leitor === 'generico',
    marca: cv.marcaDoBanco(banco),
    banco,
    bancos: cv.NOMES_DE_BANCO.map(nome => ({ nome, marcado: nome === banco })),
    escolherBanco: s.escolherBanco,
    qtd: linhas.length,
    resumo: ok ? [
      extrator.dataBR(datas[0]) + ' a ' + extrator.dataBR(datas[datas.length - 1]),
      'Entradas ' + extrator.reaisBR(entradas),
      'Saídas ' + extrator.reaisBR(saidas),
    ] : [],
    aceitar: cv.EXTENSOES_CONVERSOR.join(','),
    ler: (fs: File[]) => { if (fs[0]) void s.ler(fs[0]); },
    tirar: s.tirar,
  };
}
