// ViewModel do cartão "Trocas para você responder" (Vitor, 07/10/2026): os pedidos em que quem está trabalhando é um dos
// lados e ainda não aceitou, agrupados pela troca (as empresas que saem e as que entram), com um Aceitar / Recusar para a
// troca inteira. Fica em Minhas empresas.
import { empresas, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useGravarCadastro, useTodosOsCadastros } from '../../../dados/repo';
import { useNovidade } from '../../../../../comum/novidades';
import { usePendenciasNaTroca } from './usePendenciasNaTroca';

const cad = empresas.cadastro;

export function useTransferenciasPendentes() {
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const eu = useOperador().operador?.nome || '';
  const { toast } = useRetorno();
  const equipe = useAcesso().equipe().lista;
  const pedidos = todos.carregada ? cad.transferenciasParaResponder(todos.porId.values(), eu) : [];
  // as pendências só com pedido para responder (sem pedido, nenhuma leitura a mais)
  const pend = usePendenciasNaTroca(useNovidade('pendencias-na-troca') && pedidos.length > 0);
  const grupos = new Map<string, typeof pedidos>();
  for (const p of pedidos) {
    const k = p.t.troca || p.cadastro.nome + '|' + p.dep;
    grupos.set(k, [...(grupos.get(k) || []), p]);
  }
  return {
    trocas: [...grupos.entries()].map(([chave, itens]) => {
      const outro = itens[0].papel === 'emitente' ? itens[0].t.para : itens[0].t.de;
      return {
        chave, outro,
        foto: { foto: equipe.find(p => p.nome.toLowerCase() === outro.toLowerCase())?.fotoPerfil || null, iniciais: usuarios.iniciais(outro) },
        saem: itens.filter(i => i.papel === 'emitente').map(i => i.cadastro.nome),
        entram: itens.filter(i => i.papel === 'destinatario').map(i => i.cadastro.nome),
        /** o que vem junto nas empresas que entram (ficha M02): "ISS (atrasada), DAS (no prazo interno)" */
        pendentesQueEntram: itens.filter(i => i.papel === 'destinatario')
          .flatMap(i => pend.de(i.cadastro.nome, i.cadastro.codigo, i.dep).map(p => i.cadastro.nome + ' › ' + p.nome + (p.tipo === 'atrasada' ? ' (atrasada)' : p.tipo === 'no-interno' ? ' (no prazo interno)' : ' (parada)'))),
        responder(aceita: boolean) {
          for (const i of itens) void gravar(i.cadastro.nome, i.cadastro.codigo, atual => cad.responderTransferencia(atual, i.dep, eu, aceita, new Date()));
          toast(aceita ? 'Troca aceita.' : 'Troca recusada.');
        },
      };
    }),
  };
}
