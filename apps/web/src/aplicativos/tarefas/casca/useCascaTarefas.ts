// ViewModel da casca da Tarefas: as aplicações na gaveta ☰ (Minhas empresas, Contábil, Fiscal, Drive,
// Contato), as páginas da aplicação aberta na barra lateral, o título e quem está trabalhando.
import { usuarios } from '@nads/core';
import { useLocation, useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { aplicacao, aplicacoesDe, BASE, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';

export function useCascaTarefas(app: IdAplicacao, pagina: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  const { escolher, comLogin } = useOperador();
  const op = useOperador().operador as Operador;
  const a = aplicacao(app);
  return {
    // no lugar da empresa (a Tarefas não tem uma empresa aberta): quem está trabalhando
    empresa: { codigo: op.nome, nome: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
    versao: VERSAO_SISTEMA,
    titulo: a?.paginas.find(p => p.id === pagina)?.titulo || a?.nome || '',
    secoes: (a?.paginas || []).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, grupo: 1, ativa: p.id === pagina })),
    paginas: [],
    aplicacoes: aplicacoesDe(op).map(x => ({ id: x.id, nome: x.nome, icone: x.icone, ativo: x.id === app })),
    // páginas da mesma aplicação mantêm a competência escolhida (fica na URL)
    onSecao: (id: string) => navegar(caminhoDaPagina(app, id) + search),
    onAplicacao: (id: string) => { const x = aplicacao(id); if (x) navegar(caminhoDaPagina(x.id, x.paginas[0].id)); },
    inicio: () => navegar(BASE),
    trocarPessoa: () => escolher(null),
    /** o perfil no canto do cabeçalho (como o do GitHub): as iniciais, o nome e trocar de pessoa / sair */
    perfil: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
  };
}
