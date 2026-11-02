// ViewModel da janela do fornecedor (28/10/2026: "o cadastro de fornecedores do Toriba, no nads"): a razão social, o nome
// fantasia, o CNPJ ou CPF, a conta contábil que vem preenchida na conta a pagar e o ativo; a conferência
// (financeiro.conferirFornecedor) e gravar. Não se apaga: o fornecedor que sai de uso fica inativo (as contas dele ficam).
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useCaixa, useContasPagar } from '../../dados/repo';
import { documentoFormatado } from './formatosDaNota';

export function useJanelaDoFornecedor(id: string | undefined, fechar: () => void) {
  const repo = useContasPagar();
  const plano = useCaixa().plano().lista;
  const { toast } = useRetorno();
  const quem = useOperador().operador?.nome || '';
  const existente = id ? repo.fornecedores().lista.find(f => f.id === id) : undefined;
  const [razaoSocial, setRazaoSocial] = useState(existente?.razaoSocial ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(existente?.nomeFantasia ?? '');
  const [documento, setDocumento] = useState(existente?.documento ? documentoFormatado(existente.documento) : '');
  const [contaPadrao, setContaPadrao] = useState(financeiro.contaPadraoDoFornecedor(existente, plano));
  // a conta que veio do Toriba e não está no plano fica como está, até a pessoa escolher outra
  const [mexeuNaConta, setMexeuNaConta] = useState(false);
  const [ativo, setAtivo] = useState(existente?.ativo ?? true);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  return {
    novo: !id, existente,
    contas: plano.filter(c => (c.movimentavel && c.ativo) || c.id === contaPadrao),
    razaoSocial, setRazaoSocial, nomeFantasia, setNomeFantasia, documento, setDocumento, contaPadrao, ativo, setAtivo,
    setContaPadrao(v: string) { setContaPadrao(v); setMexeuNaConta(true); },
    formatarDocumento: () => setDocumento(documentoFormatado(documento)),
    erros, salvando,
    async salvar() {
      const f = { id, razaoSocial, nomeFantasia, documento, contaPadrao: contaPadrao || (mexeuNaConta ? undefined : existente?.contaPadrao), ativo };
      const problemas = financeiro.conferirFornecedor(f);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try {
        await repo.salvarFornecedor(f, quem);
        toast(id ? 'Fornecedor alterado.' : 'Fornecedor cadastrado.');
        fechar();
      } catch (e) {
        setErros([e instanceof Error ? e.message : 'Não consegui gravar.']);
      } finally {
        setSalvando(false);
      }
    },
  };
}
