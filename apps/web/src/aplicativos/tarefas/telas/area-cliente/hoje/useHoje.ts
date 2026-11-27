// ViewModel do Hoje da Área do Cliente. 26/11/2026: o módulo refeito. 27/11/2026 ("se baseia na UI deles e monte um para
// nós": o TaxDome, o Karbon e o Intercom): três filas com o tempo de espera de cada coisa (a equipe, o cliente, os arquivos
// para revisar), uma lista só com abas, e a conta por responsável ao lado. Tocar abre a solicitação ou o arquivo (?abrir=).
// As regras ficam em dados/hojeDaArea.ts.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAreaCliente } from '../../../dados/repo';
import { contarFila, filaDoHoje, filaPorResponsavel, resumoDoHoje, SEM_RESPONSAVEL, type FilaDoHoje, type ItemDaFila } from '../../../dados/hojeDaArea';
import { caminhoDaPagina } from '../../../casca/navegacao';
import { useEmpresasDaPessoa as useResponsaveis } from '../../empresas/andamento';
import { dataEHora } from '../base/comum';
import { useEmpresasDaPessoa } from '../base/useEmpresasDaPessoa';

/** o que cada fila é, para o título das abas e o vazio */
export const FILAS: readonly { id: FilaDoHoje; rotulo: string; vazio: string }[] = [
  { id: 'equipe', rotulo: 'Esperando a equipe', vazio: 'Nenhum cliente esperando resposta.' },
  { id: 'cliente', rotulo: 'Esperando o cliente', vazio: 'Nada pedido ao cliente sem resposta.' },
  { id: 'revisar', rotulo: 'Arquivos para revisar', vazio: 'Nenhum arquivo esperando aprovação.' },
];

/** "hoje", "há 1 dia", "há 4 dias" */
export const textoDaEspera = (dias: number) => (dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : 'há ' + dias + ' dias');

export function useHoje() {
  const repo = useAreaCliente();
  const navegar = useNavigate();
  const agora = useMemo(() => new Date(), []);
  // só as empresas da pessoa (26/11/2026: "a pessoa vai ver apenas as empresas dela")
  const daPessoa = useEmpresasDaPessoa();
  const responsaveis = useResponsaveis();
  const [fila, setFila] = useState<FilaDoHoje>('equipe');
  const [responsavel, setResponsavel] = useState('');
  const doBanco = { chamados: repo.chamados(), recebidos: repo.recebidos(), links: repo.links(), pessoas: repo.pessoas() };
  const comunicados = repo.comunicados();
  const chamados = { ...doBanco.chamados, carregada: doBanco.chamados.carregada && daPessoa.carregada, lista: doBanco.chamados.lista.filter(c => daPessoa.podeAlguma(c.codigos)) };
  const recebidos = { ...doBanco.recebidos, carregada: doBanco.recebidos.carregada && daPessoa.carregada, lista: doBanco.recebidos.lista.filter(r => daPessoa.pode(r.codigo)) };
  const links = { ...doBanco.links, lista: doBanco.links.lista.filter(l => daPessoa.pode(l.codigo)) };
  const pessoas = { ...doBanco.pessoas, lista: doBanco.pessoas.lista.filter(x => daPessoa.pode(x.codigo)) };
  const ir = (pagina: string, abrir?: string) => navegar(caminhoDaPagina('area-cliente', pagina) + (abrir ? '?abrir=' + encodeURIComponent(abrir) : ''));

  const itens = filaDoHoje({ chamados: chamados.lista, recebidos: recebidos.lista, agora });
  // o responsável: o do DP nas solicitações do DP; nas outras, o do Fiscal da empresa no Cadastro
  // (o da planilha vem em maiúsculas, "HEVERTON": fica "Heverton", como nas outras telas)
  const nomeBonito = (n: string) => (n && n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);
  const responsavelDe = (i: ItemDaFila) => (i.doDp ? 'DP' : i.codigo != null ? nomeBonito(responsaveis.responsavel({ nome: i.empresa, codigo: i.codigo }, 'fiscal')) : '');
  const conta = contarFila(itens);
  const porResponsavel = filaPorResponsavel(itens, responsavelDe);
  const daFila = itens.filter(i => i.fila === fila && (!responsavel || (responsavelDe(i) || SEM_RESPONSAVEL) === responsavel));
  const resumo = resumoDoHoje({ chamados: chamados.lista, recebidos: recebidos.lista, comunicados: comunicados.lista, links: links.lista, pessoas: pessoas.lista, agora });

  return {
    exemplos: repo.exemplos,
    carregando: !chamados.carregada || !recebidos.carregada,
    // o erro de ler as solicitações ou os recebidos (os outros números ficam em zero sem atrapalhar)
    erro: chamados.erro || recebidos.erro,
    resumo,
    conta,
    fila, setFila, filas: FILAS,
    responsavel, setResponsavel,
    porResponsavel,
    itens: daFila.map(i => ({
      ...i,
      chave: i.fila + i.id,
      espera: textoDaEspera(i.dias),
      desdeCompleto: dataEHora(i.desde),
      responsavel: responsavelDe(i),
    })),
    abrir: (i: ItemDaFila) => (i.fila === 'revisar' ? ir('documentos', i.id) : ir('solicitacoes', i.id)),
    ir: {
      solicitacoes: () => ir('solicitacoes'), documentos: () => ir('documentos'),
      comunicados: () => ir('comunicados'), clientes: () => ir('clientes'),
    },
  };
}
