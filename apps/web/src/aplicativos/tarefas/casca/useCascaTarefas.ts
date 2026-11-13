// ViewModel da casca da Tarefas: as aplicações na gaveta ☰ (Minhas empresas, Contábil, Fiscal, Drive,
// Contato), as páginas da aplicação aberta na barra lateral, o título e quem está trabalhando.
import { usuarios } from '@nads/core';
import { useRetorno, type NomeIcone } from '@nads/ui';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { aplicacao, aplicacoesDe, BASE, caminhoDaPagina, FERRAMENTAS_DO_FISCAL, type IdAplicacao } from './navegacao';
import { useOperador, type Operador } from './operador';
import { useAcesso, useTarefasDelegadas } from '../dados/repo';
import { usePessoal } from '../telas/pessoal/contexto';
import { useModoDesenvolvedor } from '../../../comum/modoDesenvolvedor';
import { useNovidade } from '../../../comum/novidades';
import { tarefas } from '@nads/core';
import { abaDaUrl, ABAS_DO_INICIO, LISTAS_DAS_TAREFAS, listaDaUrl } from '../telas/inicio/abasDoInicio';
import { aplicarSimulacao, useSaudacaoSimulada } from '../telas/inicio/saudacaoSimulada';

export function useCascaTarefas(app: IdAplicacao, pagina: string) {
  const navegar = useNavigate();
  const { search } = useLocation();
  const { escolher, comLogin } = useOperador();
  const op = useOperador().operador as Operador;
  // as páginas que a pessoa vê
  const a = aplicacoesDe(op).find(x => x.id === app) ?? aplicacao(app);
  // o Cadastro também com a barra lateral (14/10/2026: "cadê a barra?"), como os outros módulos; as abas no alto não voltam
  // o Fiscal com as páginas no alto, para a tabela usar a tela toda (Vitor, 09/11/2026: "quero colocar esse menu lateral, superior")
  // a Carteira também (Vitor, 12/11/2026: "coloque tudo do menu lateral, no superior"); quem ainda não tem a Carteira só tem
  // a tela "em desenvolvimento", sem abas. O Financeiro também (Vitor, 12/11/2026: "coloca o menu superior") e o DP ("para aumentar o espaço da tabela")
  // o Início novo (só no modo desenvolvedor) também (Vitor, 13/11/2026: "Menu superior abaixo do cabeçalho!")
  const inicioNovo = useNovidade('inicio-novo') && app === 'inicio';
  const comAbas = inicioNovo || app === 'administrativo' || app === 'fiscal' || app === 'financeiro' || app === 'dp' || (app === 'carteira' && (a?.paginas.length ?? 0) > 1);
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
  // o Início novo (só no modo desenvolvedor): a saudação no lugar do título "Início" (Vitor, 13/11/2026: "Olá, Vitor. deixa no
  // lugar do inicio"; "Fica variando, as frases"), a mesma frase dentro do turno; e as abas no alto ("Menu superior abaixo do
  // cabeçalho!")
  const simulada = useSaudacaoSimulada();
  const daEquipe = acesso.equipe().lista.find(u => u.nome === op.nome);
  const real = { agora: new Date(), aniversario: String((daEquipe && acesso.equipe().docs[daEquipe.uid]?.aniversario) || '') };
  const s = dev ? aplicarSimulacao(real.agora, real.aniversario, simulada) : real;
  const abaDoInicio = abaDaUrl(new URLSearchParams(search).get('aba'));
  // a saudação só no Painel (Vitor, 13/11/2026: "Saudações só no painel principal, remova dessas paginas"): nas outras abas, a linha
  // do título fica só com as ações
  const tituloDoInicio = inicioNovo && abaDoInicio === 'painel' ? tarefas.saudacao.saudacao({ nome: op.nome, quem: daEquipe?.uid || op.nome, agora: s.agora, aniversario: s.aniversario, troca: dev ? simulada.troca : 0, simulando: dev && Object.keys(simulada).length > 0 }) : '';
  // as Tarefas do Início novo com a barra lateral padrão do nads (Vitor, 13/11/2026: "Menu lateral padrão nads!"): Minhas tarefas,
  // Delegadas por mim e Concluídas, com quantas tem (sem os documentos delegados, que ficam só na aba Documentos)
  const tarefasNoInicio = inicioNovo && abaDoInicio === 'tarefas';
  const listaDoInicio = listaDaUrl(new URLSearchParams(search).get('lista'));
  const delegadas = useTarefasDelegadas();
  const quantas = tarefasNoInicio ? tarefas.delegadas.contarAbas(delegadas.lista().tarefas.filter(t => !tarefas.delegadas.pedeDocumentos(t)), delegadas.eu()?.uid || '') : null;
  return {
    // a Tarefas não tem uma empresa aberta: a trilha fica só com o caminho (Vitor, 05/10/2026: sem o "Vitor · Sair da
    // conta" — sair fica no avatar)
    empresa: null,
    versao: VERSAO_SISTEMA,
    titulo: inicioNovo ? tituloDoInicio : a?.paginas.find(p => p.id === pagina)?.titulo || a?.nome || '',
    // o Cadastro com as páginas em abas no alto (Empresas, Usuários, Configurações; Vitor, 05/10/2026), sem a barra lateral
    comAbas,
    /** sem a barra lateral: as abas no alto dão conta (só a aba Ferramentas do Fiscal tem barra) */
    soAbas: comAbas && !emFerramentas && !tarefasNoInicio,
    /** as tabelas do Fiscal sem o título, que repetia a aba (09/11/2026: "um aproveitamento maior da tela") */
    semTitulo: app === 'fiscal' && ['relatorio-simples', 'relatorio-presumido', 'reinf'].includes(pagina),
    // os blocos com nome (as Configurações: Cadastro e Admin; 28/10/2026): o nome em cima da primeira página de cada um
    secoes: tarefasNoInicio ? LISTAS_DAS_TAREFAS.map(l => ({ id: l.id, rotulo: l.rotulo, icone: l.icone, grupo: 1, ativa: l.id === listaDoInicio, contador: quantas && quantas[l.id] ? String(quantas[l.id]) : undefined }))
      : comAbas && !emFerramentas ? [] : (a?.paginas || []).filter(p => !comAbas || ehFerramenta(p.id)).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, marca: p.marca === 'fgts' ? p.marca : undefined, grupo: p.secao ? 1 + [...new Set(a?.paginas.map(x => x.secao))].indexOf(p.secao) : 1, titulo: p.secao, ativa: p.id === pagina, travada: !!p.emDesenvolvimento })),
    paginas: inicioNovo ? ABAS_DO_INICIO.map(x => ({ id: x.id, rotulo: x.rotulo, icone: x.icone as NomeIcone, ativa: x.id === abaDoInicio })) : comAbas ? [
      ...(a?.paginas || []).filter(p => !ehFerramenta(p.id)).map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone as NomeIcone, marca: p.marca === 'fgts' ? undefined : p.marca, ativa: p.id === pagina })),
      ...(app === 'fiscal' ? [{ id: 'ferramentas', rotulo: 'Ferramentas', icone: 'wrench' as NomeIcone, ativa: emFerramentas }] : []),
    ] : [],
    /** a aba do alto (o Cadastro): a página, mantendo a competência */
    onPagina: (id: string) => inicioNovo ? navegar(BASE + '/inicio?aba=' + id, { replace: true }) : navegar(caminhoDaPagina(app, id === 'ferramentas' ? FERRAMENTAS_DO_FISCAL[0] : id) + search),
    // o Início já tem o item dele no alto da gaveta
    // as Configurações saem da lista: ficam no pé da gaveta, só com o ícone da engrenagem (Vitor, 28/10/2026)
    aplicacoes: aplicacoesDe(op).filter(x => x.id !== 'inicio' && x.id !== 'cadastro' && x.id !== 'ferramentas').map(x => ({ id: x.id, nome: x.nome, icone: x.icone, grupo: x.grupo, marca: x.marca, ativo: x.id === app })),
    // páginas da mesma aplicação mantêm a competência escolhida (fica na URL)
    // a página em desenvolvimento não abre: só o aviso (21/10/2026)
    onSecao: (id: string) => {
      if (tarefasNoInicio) { navegar(BASE + '/inicio?aba=tarefas&lista=' + id, { replace: true }); return; }
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
