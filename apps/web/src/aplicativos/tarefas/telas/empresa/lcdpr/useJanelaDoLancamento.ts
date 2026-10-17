// ViewModel da janela de um lançamento do LCDPR (o "Ver/editar detalhes" da linha no lcdpr.html): as contas, o código e
// o texto do histórico, o imóvel, os tipos, o CPF/CNPJ, o documento, o valor e os produtos, corrigidos à mão. Salvar troca
// o lançamento na sessão (o valor aceita "1.234,56"); corrigir à mão não tira de REVISAR (como lá: isso é a categoria).
import { formatos, lcdpr } from '@nads/core';
import { useState } from 'react';
import { lerSessao, mudarSessao, useSessaoDoLcdpr } from './useSessaoDoLcdpr';

export const CAMPOS_DO_LANCAMENTO: readonly { id: lcdpr.CampoEditavel; rotulo: string; icone: 'hash' | 'landmark' | 'fileText' | 'briefcase' | 'dinheiro' | 'list' | 'recibo'; numerico?: boolean }[] = [
  { id: 'contaDeved', rotulo: 'Conta devedora', icone: 'hash', numerico: true },
  { id: 'contaCred', rotulo: 'Conta credora', icone: 'hash', numerico: true },
  { id: 'codHist', rotulo: 'Cód. histórico', icone: 'hash', numerico: true },
  { id: 'historico', rotulo: 'Histórico', icone: 'fileText' },
  { id: 'imovel', rotulo: 'Imóvel', icone: 'landmark' },
  { id: 'tipoDoc', rotulo: 'Tipo doc.', icone: 'recibo' },
  { id: 'tipoLanc', rotulo: 'Tipo lançamento', icone: 'list' },
  { id: 'cnpj', rotulo: 'CPF/CNPJ', icone: 'briefcase', numerico: true },
  { id: 'documento', rotulo: 'Documento', icone: 'recibo' },
  { id: 'valor', rotulo: 'Valor', icone: 'dinheiro' },
  { id: 'produto', rotulo: 'Produto(s)', icone: 'list' },
];

const comoTexto = (l: lcdpr.Lancamento, c: lcdpr.CampoEditavel) => (c === 'valor' ? formatos.brl(Number(l.valor) || 0) : String(l[c] ?? ''));

export function useJanelaDoLancamento(id: number, fechar: () => void) {
  const l = useSessaoDoLcdpr().lancamentos.find(x => x.id === id) || null;
  const [rascunho, setRascunho] = useState<Partial<Record<lcdpr.CampoEditavel, string>>>({});
  return {
    lancamento: l && {
      fornecedor: l.fornecedor || '(sem fornecedor)', origem: l.origem === 'NF' ? 'Nota fiscal' : 'CT-e', revisar: l.revisar, categoria: l.categoria,
      resumo: [l.documento ? 'nº ' + l.documento : '', lcdpr.dataBr(l.data), formatos.reais(Number(l.valor) || 0), l.ncm ? 'NCM ' + l.ncm : ''].filter(Boolean).join(' · '),
    },
    campos: l ? CAMPOS_DO_LANCAMENTO.map(c => ({ ...c, valor: rascunho[c.id] ?? comoTexto(l, c.id) })) : [],
    mudar: (c: lcdpr.CampoEditavel, v: string) => setRascunho(x => ({ ...x, [c]: c === 'historico' || c === 'produto' ? lcdpr.umaLinha(v) : v })),
    mudou: Object.keys(rascunho).length > 0,
    salvar() {
      const atual = lerSessao().lancamentos.find(x => x.id === id);
      if (atual && Object.keys(rascunho).length) {
        const novo: lcdpr.Lancamento = { ...atual };
        for (const [c, v] of Object.entries(rascunho) as [lcdpr.CampoEditavel, string][]) {
          if (c === 'valor') novo.valor = lcdpr.numeroDaCelula(v);
          else if (c === 'cnpj') novo.cnpj = lcdpr.soDigitos(v);
          else novo[c] = v.trim();
        }
        mudarSessao(x => ({ ...x, lancamentos: x.lancamentos.map(y => (y.id === id ? novo : y)) }));
      }
      fechar();
    },
  };
}
