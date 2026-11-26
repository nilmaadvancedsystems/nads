// ViewModel do Hoje da Área do Cliente (26/11/2026, o módulo refeito): os números de cada seção, as solicitações que
// esperam a equipe e os últimos arquivos. Tocar leva à seção (a solicitação e o arquivo já abertos, por ?abrir=). As
// regras ficam em dados/hojeDaArea.ts.
import { areaCliente as ac } from '@nads/core';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAreaCliente } from '../../../dados/repo';
import { resumoDoHoje, solicitacoesQueEsperam, ultimosRecebidos } from '../../../dados/hojeDaArea';
import { caminhoDaPagina } from '../../../casca/navegacao';
import { dataEHora, haQuanto } from '../base/comum';
import { useEmpresasDaPessoa } from '../base/useEmpresasDaPessoa';

export function useHoje() {
  const repo = useAreaCliente();
  const navegar = useNavigate();
  const agora = useMemo(() => new Date(), []);
  // só as empresas da pessoa (26/11/2026: "a pessoa vai ver apenas as empresas dela")
  const daPessoa = useEmpresasDaPessoa();
  const doBanco = { chamados: repo.chamados(), recebidos: repo.recebidos(), links: repo.links(), pessoas: repo.pessoas() };
  const comunicados = repo.comunicados();
  const chamados = { ...doBanco.chamados, carregada: doBanco.chamados.carregada && daPessoa.carregada, lista: doBanco.chamados.lista.filter(c => daPessoa.podeAlguma(c.codigos)) };
  const recebidos = { ...doBanco.recebidos, carregada: doBanco.recebidos.carregada && daPessoa.carregada, lista: doBanco.recebidos.lista.filter(r => daPessoa.pode(r.codigo)) };
  const links = { ...doBanco.links, lista: doBanco.links.lista.filter(l => daPessoa.pode(l.codigo)) };
  const pessoas = { ...doBanco.pessoas, lista: doBanco.pessoas.lista.filter(x => daPessoa.pode(x.codigo)) };
  const ir = (pagina: string, abrir?: string) => navegar(caminhoDaPagina('area-cliente', pagina) + (abrir ? '?abrir=' + encodeURIComponent(abrir) : ''));
  return {
    exemplos: repo.exemplos,
    carregando: !chamados.carregada || !recebidos.carregada,
    // o erro de ler as solicitações ou os recebidos (os outros números ficam em zero sem atrapalhar)
    erro: chamados.erro || recebidos.erro,
    resumo: resumoDoHoje({ chamados: chamados.lista, recebidos: recebidos.lista, comunicados: comunicados.lista, links: links.lista, pessoas: pessoas.lista, agora }),
    esperando: solicitacoesQueEsperam(chamados.lista).map(c => ({
      id: c.id, titulo: c.titulo, empresa: c.empresa, codigo: c.codigos[0] ?? null, semResposta: c.situacao === 'aberto',
      quando: haQuanto(c.atualizadoEm, agora), quandoCompleto: dataEHora(c.atualizadoEm),
    })),
    ultimos: ultimosRecebidos(recebidos.lista).map(r => ({ id: r.id, nome: r.nome, tipo: ac.TIPOS_DE_ENVIO.find(t => t.valor === r.tipo)?.rotulo ?? r.tipo, empresa: r.empresa, codigo: r.codigo, quando: haQuanto(r.recebidoEm, agora), quandoCompleto: dataEHora(r.recebidoEm) })),
    ir: {
      solicitacoes: () => ir('solicitacoes'), documentos: () => ir('documentos'),
      comunicados: () => ir('comunicados'), clientes: () => ir('clientes'),
    },
    abrirSolicitacao: (id: string) => ir('solicitacoes', id),
    abrirRecebido: (id: string) => ir('documentos', id),
  };
}
