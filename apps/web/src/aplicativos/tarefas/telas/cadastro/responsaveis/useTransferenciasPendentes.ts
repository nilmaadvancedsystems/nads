// ViewModel do cartão "Trocas para você responder" (Vitor, 07/10/2026): os pedidos em que quem está trabalhando é um dos
// lados e ainda não aceitou, agrupados pela troca (as empresas que saem e as que entram), com um Aceitar / Recusar para a
// troca inteira. Fica em Minhas empresas.
import { empresas, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useOperador } from '../../../casca/operador';
import { useAcesso, useGravarCadastro, useTodosOsCadastros } from '../../../dados/repo';

const cad = empresas.cadastro;

export function useTransferenciasPendentes() {
  const todos = useTodosOsCadastros();
  const gravar = useGravarCadastro();
  const eu = useOperador().operador?.nome || '';
  const { toast } = useRetorno();
  const equipe = useAcesso().equipe().lista;
  const pedidos = todos.carregada ? cad.transferenciasParaResponder(todos.porId.values(), eu) : [];
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
        responder(aceita: boolean) {
          for (const i of itens) void gravar(i.cadastro.nome, i.cadastro.codigo, atual => cad.responderTransferencia(atual, i.dep, eu, aceita, new Date()));
          toast(aceita ? 'Troca aceita.' : 'Troca recusada.');
        },
      };
    }),
  };
}
