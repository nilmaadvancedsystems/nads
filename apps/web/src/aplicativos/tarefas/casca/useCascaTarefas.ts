// ViewModel da casca da Tarefas: as aplicações na gaveta ☰ (Minhas empresas, Contábil, Fiscal, Drive,
// Contato), as páginas da aplicação aberta na barra lateral, o título e quem está trabalhando.
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useLocation, useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { aplicacao, aplicacoesDe, BASE, caminhoDaPagina, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';
import { useAcesso } from '../dados/repo';
import { usePessoal } from '../telas/pessoal/contexto';
import { useModoDesenvolvedor } from '../../../comum/modoDesenvolvedor';

export function useCascaTarefas(app: IdAplicacao, pagina: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  const { escolher, comLogin } = useOperador();
  const op = useOperador().operador as Operador;
  // as páginas que a pessoa vê
  const a = aplicacoesDe(op).find(x => x.id === app) ?? aplicacao(app);
  // o Cadastro também com a barra lateral (14/10/2026: "cadê a barra?"), como os outros módulos; as abas no alto não voltam
  // Minhas empresas com as páginas no menu de cima (Empresas, Justificativas, Configurações; Vitor, 28/10/2026)
  const comAbas = app === 'minhas-empresas';
  const pessoal = usePessoal();
  const acesso = useAcesso();
  // o modo desenvolvedor (no avatar): só ver, sem alterar (Vitor, 06/10/2026)
  const [dev, setDev] = useModoDesenvolvedor();
  const { aviso } = useRetorno();
  return {
    // a Tarefas não tem uma empresa aberta: a trilha fica só com o caminho (Vitor, 05/10/2026: sem o "Vitor · Sair da
    // conta" — sair fica no avatar)
    empresa: null,
    versao: VERSAO_SISTEMA,
    titulo: a?.paginas.find(p => p.id === pagina)?.titulo || a?.nome || '',
    // o Cadastro com as páginas em abas no alto (Empresas, Usuários, Configurações; Vitor, 05/10/2026), sem a barra lateral
    comAbas,
    secoes: comAbas ? [] : (a?.paginas || []).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, marca: p.marca, grupo: 1, ativa: p.id === pagina, travada: !!p.emDesenvolvimento })),
    paginas: comAbas ? (a?.paginas || []).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina })) : [],
    /** a aba do alto (o Cadastro): a página, mantendo a competência */
    onPagina: (id: string) => navegar(caminhoDaPagina(app, id) + search),
    // o Início já tem o item dele no alto da gaveta
    aplicacoes: aplicacoesDe(op).filter(x => x.id !== 'inicio').map(x => ({ id: x.id, nome: x.nome, icone: x.icone, grupo: x.grupo, marca: x.marca, ativo: x.id === app })),
    // páginas da mesma aplicação mantêm a competência escolhida (fica na URL)
    // a página em desenvolvimento não abre: só o aviso (21/10/2026)
    onSecao: (id: string) => {
      const p = a?.paginas.find(x => x.id === id);
      if (p?.emDesenvolvimento) { aviso({ tom: 'info', titulo: p.rotulo + ': em desenvolvimento', texto: 'Esta tela ainda não está liberada.' }); return; }
      navegar(caminhoDaPagina(app, id) + search);
    },
    onAplicacao: (id: string) => { const x = aplicacao(id); if (x) navegar(caminhoDaPagina(x.id, x.paginas[0].id)); },
    inicio: () => navegar(BASE),
    trocarPessoa: () => escolher(null),
    /** o perfil no canto do cabeçalho (como o do GitHub): as iniciais, o nome e trocar de pessoa / sair */
    perfil: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), foto: acesso.minhaFoto(), sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
    /** a Minha página (a janela flutuante da pessoa, como as Configurações do Notion), aberta pelo avatar: um tópico dela */
    abrirPessoal: (topico: string) => pessoal.abrir(topico),
    naPessoal: pessoal.topico !== null,
    dev, setDev,
    /** o link Admin no pé da gaveta (só o admin) */
    admin: op.admin,
  };
}
