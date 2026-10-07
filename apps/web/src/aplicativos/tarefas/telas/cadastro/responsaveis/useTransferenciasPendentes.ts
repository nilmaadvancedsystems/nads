// ViewModel do cartão "Transferências para você responder" (Vitor, 07/10/2026: a empresa é transferida com a permissão do
// emitente e do destinatário): os pedidos em que quem está trabalhando é o emitente (o responsável de hoje) ou o
// destinatário e ainda não aceitou, com o Aceitar e o Recusar. Fica em Minhas empresas (o Cadastro é só do admin).
import { empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../../casca/operador';
import { useGravarCadastro, useTodosOsCadastros } from '../../../dados/repo';

const cad = empresas.cadastro;

export function useTransferenciasPendentes() {
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const eu = useOperador().operador?.nome || '';
  const { toast } = useRetorno();
  const pedidos = todos.carregada ? cad.transferenciasParaResponder(todos.porId.values(), eu) : [];
  return {
    pedidos: pedidos.map(p => ({
      chave: p.cadastro.nome + '|' + p.dep,
      empresa: p.cadastro.nome,
      codigo: p.cadastro.codigo,
      dep: p.dep,
      departamento: cad.DEPARTAMENTOS_DO_RESPONSAVEL.find(d => d.id === p.dep)?.rotulo || p.dep,
      de: p.t.de,
      para: p.t.para,
      pedidoPor: p.t.pedidoPor,
      quando: p.t.em ? new Date(p.t.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
      papel: p.papel,
      /** o outro lado ainda precisa aceitar? */
      faltaOutro: cad.faltamAceitar(p.t).length > 1,
    })),
    responder(empresa: string, codigo: number | null, dep: empresas.cadastro.DepartamentoDoResponsavel, aceita: boolean, faltaOutro: boolean) {
      void gravar(empresa, codigo, atual => cad.responderTransferencia(atual, dep, eu, aceita, new Date()));
      toast(!aceita ? 'Transferência recusada.' : faltaOutro ? 'Aceito. Falta o aceite do outro lado.' : 'Transferência feita.');
    },
  };
}
