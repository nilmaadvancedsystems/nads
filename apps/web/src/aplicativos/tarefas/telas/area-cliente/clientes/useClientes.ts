// ViewModel da seção Clientes do módulo Área do Cliente refeito (26/11/2026: "quero que esse modulo seja completamente
// refeito para suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o
// mais bonito e de facil entendimento possivel"). Quem tem acesso, numa lista só: todas as empresas do cadastro com o
// link, a senha, a logo e a última guia aberta; o filtro, a busca e a empresa aberta no painel. As regras são de
// dados/clientesDaArea.ts.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { clientesDoFiltro, contarFiltros, FILTROS_DOS_CLIENTES, montarClientes, resumoDosClientes, textoDaSenha, type FiltroDosClientes } from '../../../dados/clientesDaArea';
import { useAreaCliente } from '../../../dados/repo';
import { useOperador } from '../../../casca/operador';
import { useEmpresasDaPessoa } from '../base/useEmpresasDaPessoa';
import { dataEHora, ehFaltaDeRegra, haQuanto } from '../base/comum';

/** O aviso curto de uma lista que o banco não deixou ler (pessoas, guias abertas). */
const avisoDe = (erro: string, oQue: string) => (!erro ? '' : ehFaltaDeRegra(erro) ? 'O banco ainda não deixa ver ' + oQue + ' (falta a regra do Vitor).' : 'Não consegui ler ' + oQue + '.');

export function useClientes() {
  const repo = useAreaCliente();
  // só as empresas da pessoa (26/11/2026: "a pessoa vai ver apenas as empresas dela")
  const daPessoa = useEmpresasDaPessoa();
  // a senha e as pessoas só para o admin (26/11/2026: "isso aqui do link da empresa deve aparecer apenas para admim"):
  // sem admin, nem se abre o ouvinte de cada link (areasCliente/{token})
  const admin = !!useOperador().operador?.admin;
  const empresas = daPessoa.empresas;
  const links = repo.links();
  const logos = repo.logos();
  const pessoas = repo.pessoas();
  const leituras = repo.leituras();
  const [filtro, setFiltro] = useState<FiltroDosClientes>('todas');
  const [busca, setBusca] = useState('');
  // o atalho do Cadastro leva para cá com ?empresa=<código>: já abre o painel dela (o parâmetro sai do endereço)
  const [params, setParams] = useSearchParams();
  const pedida = Number(params.get('empresa') || NaN);
  const [aberta, setAberta] = useState<number | null>(Number.isFinite(pedida) ? pedida : null);
  useEffect(() => {
    if (params.has('empresa')) setParams(p => { const n = new URLSearchParams(p); n.delete('empresa'); return n; }, { replace: true });
  }, [params, setParams]);

  // o "Exige senha" é um documento por link (areasCliente/{token}): pedir começa a ouvir; a versão do repo redesenha
  const versao = repo.versao();
  const todos = useMemo(() => montarClientes({
    // os links também só das empresas da pessoa (o link de código fora do cadastro aparece só para quem vê todas)
    empresas, links: daPessoa.filtra ? links.lista.filter(l => daPessoa.pode(l.codigo)) : links.lista, logos: logos.lista, pessoas: pessoas.lista, leituras: leituras.lista,
    exigeSenha: token => (admin ? repo.exigeSenha(token).ligado : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [empresas, links.lista, logos.lista, pessoas.lista, leituras.lista, repo, versao, daPessoa.filtra, admin]);
  const conta = useMemo(() => contarFiltros(todos), [todos]);
  const visiveis = useMemo(() => clientesDoFiltro(todos, filtro, busca), [todos, filtro, busca]);

  const agora = new Date();
  const linhas = visiveis.map(c => ({
    codigo: c.codigo,
    nome: c.nome,
    logo: c.logo,
    temLink: !!c.token,
    senha: textoDaSenha(c),
    exigeSenha: c.exigeSenha,
    /** "há 3 h" / "Nenhuma guia aberta" / '' (sem link) */
    atividade: c.ultimaAtividade ? 'Abriu uma guia ' + haQuanto(c.ultimaAtividade, agora) : c.token ? 'Nunca abriu' : '',
    atividadeTitulo: c.ultimaAtividade ? 'Última guia aberta em ' + dataEHora(c.ultimaAtividade) + ' · ' + c.guiasAbertas + (c.guiasAbertas === 1 ? ' guia' : ' guias') + ' nos últimos 4 meses' : c.token ? 'Nenhuma guia aberta nos últimos 4 meses' : '',
    ativa: c.codigo === aberta,
  }));
  const empresaAberta = aberta == null ? null : todos.find(c => c.codigo === aberta) ?? null;

  return {
    exemplos: repo.exemplos,
    carregando: !links.carregada || !daPessoa.carregada,
    erro: links.erro,
    /** os avisos das listas de apoio (a lista principal aparece mesmo sem elas) */
    avisos: [avisoDe(pessoas.erro, 'as pessoas com senha'), avisoDe(leituras.erro, 'as guias abertas'), avisoDe(logos.erro, 'as logos')].filter(Boolean),
    filtro, mudarFiltro: setFiltro,
    admin,
    filtros: FILTROS_DOS_CLIENTES.filter(f => admin || f.valor !== 'senha').map(f => ({ ...f, conta: conta[f.valor] })),
    busca, mudarBusca: setBusca,
    resumo: admin ? resumoDosClientes(conta) : conta.com + ' com acesso',
    total: todos.length,
    linhas,
    /** o texto da lista vazia (sem empresas, ou o filtro/busca não achou) */
    vazio: !todos.length ? 'Nenhuma empresa com código no cadastro.' : busca.trim() ? 'Nenhuma empresa com "' + busca.trim() + '".' : 'Nenhuma empresa neste filtro.',
    abrir: (codigo: number) => setAberta(codigo),
    fechar: () => setAberta(null),
    empresaAberta: empresaAberta ? { codigo: empresaAberta.codigo, nome: empresaAberta.nome } : null,
  };
}
