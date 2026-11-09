// ViewModel da casca da Tarefas: as aplicações na gaveta ☰ (Minhas empresas, Contábil, Fiscal, Drive,
// Contato), as páginas da aplicação aberta na barra lateral, o título e quem está trabalhando.
import { usuarios } from '@nads/core';
import { useRetorno, type NomeIcone } from '@nads/ui';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { aplicacao, aplicacoesDe, BASE, caminhoDaPagina, FERRAMENTAS_DO_FISCAL, type IdAplicacao } from './navegacao';
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
  // o Fiscal com as páginas no alto, para a tabela usar a tela toda (Vitor, 09/11/2026: "quero colocar esse menu lateral, superior")
  const comAbas = app === 'fiscal';
  // dentro da aba Ferramentas do Fiscal, as ferramentas ficam na barra lateral
  const ehFerramenta = (id: string) => FERRAMENTAS_DO_FISCAL.includes(id);
  const emFerramentas = comAbas && ehFerramenta(pagina);
  const pessoal = usePessoal();
  const acesso = useAcesso();
  // o modo desenvolvedor (no avatar): só ver, sem alterar (Vitor, 06/10/2026)
  const [dev, setDev] = useModoDesenvolvedor();
  // só para quem tem o papel Desenvolvedor (Vitor, 06/11/2026: "apenas para quem tá desenvolvendo"): quem não tem e
  // estava com o modo ligado neste navegador volta ao normal (desligar recarrega a página)
  const podeDev = op.desenvolvedor;
  useEffect(() => { if (dev && !podeDev) setDev(false); }, [dev, podeDev, setDev]);
  const { aviso } = useRetorno();
  return {
    // a Tarefas não tem uma empresa aberta: a trilha fica só com o caminho (Vitor, 05/10/2026: sem o "Vitor · Sair da
    // conta" — sair fica no avatar)
    empresa: null,
    versao: VERSAO_SISTEMA,
    titulo: a?.paginas.find(p => p.id === pagina)?.titulo || a?.nome || '',
    // o Cadastro com as páginas em abas no alto (Empresas, Usuários, Configurações; Vitor, 05/10/2026), sem a barra lateral
    comAbas,
    /** sem a barra lateral: as abas no alto dão conta (só a aba Ferramentas do Fiscal tem barra) */
    soAbas: comAbas && !emFerramentas,
    /** as tabelas do Fiscal sem o título, que repetia a aba (09/11/2026: "um aproveitamento maior da tela") */
    semTitulo: app === 'fiscal' && ['relatorio-simples', 'relatorio-presumido', 'reinf'].includes(pagina),
    // os blocos com nome (as Configurações: Cadastro e Admin; 28/10/2026): o nome em cima da primeira página de cada um
    secoes: comAbas && !emFerramentas ? [] : (a?.paginas || []).filter(p => !comAbas || ehFerramenta(p.id)).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, marca: p.marca, grupo: p.secao ? 1 + [...new Set(a?.paginas.map(x => x.secao))].indexOf(p.secao) : 1, titulo: p.secao, ativa: p.id === pagina, travada: !!p.emDesenvolvimento })),
    paginas: comAbas ? [
      ...(a?.paginas || []).filter(p => !ehFerramenta(p.id)).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone as NomeIcone, ativa: p.id === pagina })),
      { id: 'ferramentas', rotulo: 'Ferramentas', icone: 'wrench' as NomeIcone, ativa: emFerramentas },
    ] : [],
    /** a aba do alto (o Cadastro): a página, mantendo a competência */
    onPagina: (id: string) => navegar(caminhoDaPagina(app, id === 'ferramentas' ? FERRAMENTAS_DO_FISCAL[0] : id) + search),
    // o Início já tem o item dele no alto da gaveta
    // as Configurações saem da lista: ficam no pé da gaveta, só com o ícone da engrenagem (Vitor, 28/10/2026)
    aplicacoes: aplicacoesDe(op).filter(x => x.id !== 'inicio' && x.id !== 'cadastro' && x.id !== 'ferramentas').map(x => ({ id: x.id, nome: x.nome, icone: x.icone, grupo: x.grupo, marca: x.marca, ativo: x.id === app })),
    // páginas da mesma aplicação mantêm a competência escolhida (fica na URL)
    // a página em desenvolvimento não abre: só o aviso (21/10/2026)
    onSecao: (id: string) => {
      const p = a?.paginas.find(x => x.id === id);
      if (p?.emDesenvolvimento) { aviso({ tom: 'info', titulo: p.rotulo + ': em desenvolvimento', texto: 'Esta tela ainda não está liberada.' }); return; }
      navegar(caminhoDaPagina(app, id) + search);
    },
    /** a engrenagem do pé da gaveta: a pessoa tem as Configurações? (o sênior, o diretor e o admin) e se está nelas */
    configuracoes: aplicacoesDe(op).some(x => x.id === 'cadastro') ? { ativa: app === 'cadastro' } : null,
    /** o botão das Ferramentas, ao lado da engrenagem no pé da gaveta (para todos) */
    ferramentas: { ativa: app === 'ferramentas' },
    onAplicacao: (id: string) => { const x = aplicacao(id); if (x) navegar(caminhoDaPagina(x.id, x.paginas[0].id)); },
    inicio: () => navegar(BASE),
    /** o Início da gaveta ☰ abre o Início (o mural), seja qual for a tela em que a pessoa escolheu abrir (06/11/2026) */
    abrirInicio: () => navegar(BASE + '/inicio'),
    /** "Minhas tarefas" no menu do avatar: a página, agora dentro do Início (09/11/2026) */
    abrirTarefas: () => navegar(caminhoDaPagina('inicio', 'minhas')),
    trocarPessoa: () => escolher(null),
    /** o perfil no canto do cabeçalho (como o do GitHub): as iniciais, o nome e trocar de pessoa / sair */
    perfil: { nome: op.nome, iniciais: usuarios.iniciais(op.nome), foto: acesso.minhaFoto(), sair: comLogin ? 'Sair da conta' : 'Trocar de pessoa' },
    /** a Minha página (a janela flutuante da pessoa, como as Configurações do Notion), aberta pelo avatar: um tópico dela */
    abrirPessoal: (topico: string) => pessoal.abrir(topico),
    naPessoal: pessoal.topico !== null,
    dev, setDev,
    /** a pessoa pode ligar o modo desenvolvedor? (o item no menu do avatar só aparece para ela) */
    podeDev,
    /** o link Admin no pé da gaveta (só o admin) */
    admin: op.admin,
  };
}
