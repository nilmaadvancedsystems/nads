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
    // com grupos (a Minha página): o título do grupo em cima da primeira página dele
    secoes: (a?.paginas || []).map((p, i, todas) => {
      const g = a?.grupos?.[p.id];
      const anterior = i > 0 ? a?.grupos?.[todas[i - 1].id] : undefined;
      const grupo = g === undefined ? 1 : Array.from(new Set(Object.values(a?.grupos || {}))).indexOf(g) + 1;
      return { id: p.id, rotulo: p.rotulo, icone: p.icone, grupo, ativa: p.id === pagina, ...(g && g !== anterior ? { titulo: g } : {}) };
    }),
    paginas: [],
    aplicacoes: aplicacoesDe(op).filter(x => !x.foraDaGaveta).map(x => ({ id: x.id, nome: x.nome, icone: x.icone, ativo: x.id === app })),
    // páginas da mesma aplicação mantêm a competência escolhida (fica na URL)
    onSecao: (id: string) => navegar(caminhoDaPagina(app, id) + search),
    onAplicacao: (id: string) => { const x = aplicacao(id); if (x) navegar(caminhoDaPagina(x.id, x.paginas[0].id)); },
    inicio: () => navegar(BASE),
    trocarPessoa: () => escolher(null),
    /** o perfil no canto do cabeçalho (como o do GitHub): as iniciais, o nome e trocar de pessoa / sair */
    perfil: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
    /** a Minha página (a página pessoal), aberta pelo avatar: um tópico dela */
    abrirPessoal: (topico: string) => navegar(caminhoDaPagina('pessoal', topico)),
    naPessoal: app === 'pessoal',
  };
}
