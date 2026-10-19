// ViewModel da janela da conta do plano (19/10/2026): a classificação, a descrição, o tipo, a conta pai, se está ativa e se
// recebe lançamento. O nível vem da classificação (4.1.01 é o nível 3).
import { financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useCaixa } from '../../dados/repo';

export function useJanelaDaConta(id: string | undefined, paiInicial: string | undefined, fechar: () => void) {
  const repo = useCaixa();
  const { toast } = useRetorno();
  const todas = repo.plano().lista;
  const existente = id ? todas.find(c => c.id === id) : undefined;
  const pai0 = paiInicial ? todas.find(c => c.id === paiInicial) : undefined;
  const [codigo, setCodigo] = useState(existente?.codigo ?? (pai0 ? pai0.codigo + '.' : ''));
  const [descricao, setDescricao] = useState(existente?.descricao ?? '');
  const [tipo, setTipo] = useState<financeiro.TipoDeConta>(existente?.tipo ?? pai0?.tipo ?? 'OUTROS');
  const [pai, setPai] = useState(existente?.pai ?? paiInicial ?? '');
  const [ativo, setAtivo] = useState(existente?.ativo ?? true);
  const [movimentavel, setMovimentavel] = useState(existente?.movimentavel ?? true);
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  return {
    novo: !id, existente,
    /** os pais possíveis: qualquer outra conta (a própria não) */
    pais: todas.filter(c => c.id !== id),
    codigo, setCodigo, descricao, setDescricao, tipo, setTipo, pai, setPai, ativo, setAtivo, movimentavel, setMovimentavel,
    erros, salvando,
    async salvar() {
      const problemas = financeiro.conferirConta({ codigo, descricao });
      if (todas.some(c => c.id !== id && c.codigo === codigo.trim())) problemas.push('Já existe uma conta com essa classificação.');
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try {
        await repo.salvarConta({ id, codigo: codigo.trim(), descricao: descricao.trim(), tipo, nivel: financeiro.nivelDoCodigo(codigo), pai: pai || null, ativo, movimentavel });
        toast(id ? 'Conta alterada.' : 'Conta incluída.');
        fechar();
      } catch (e) {
        setErros([e instanceof Error ? e.message : 'Não consegui gravar.']);
      } finally {
        setSalvando(false);
      }
    },
  };
}
