// ViewModel do Registro da Área do Cliente (12/11/2026: "a função de registro, onde o cliente vai ter acesso aos
// funcionários registrados, folha de pagamento, férias e afins"). O que vem do escritório (o robô grava no link):
//   - os funcionários, pelas guias do FGTS de cada mês (o CPF mascarado): quem está ativo, desde quando, a remuneração;
//   - os documentos do DP dos últimos meses (a folha, os recibos, o pró-labore, as férias, as rescisões, o FGTS, o INSS e o
//     cartão de ponto), da pasta da empresa no Drive, mês a mês e por categoria; o de um funcionário vai na ficha dele.
// E os pedidos de admissão, férias e desligamento (Vitor, 16/10/2026), que viram uma solicitação do tipo certo.
import { areaCliente as ac, formatos } from '@nads/core';
import { formatoPeloNome, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import { repoAreaCliente } from '../dados/repo';
import {
  dataBr, erroDaAdmissao, erroDaDemissao, erroDasFerias, nomeDaPessoa, resumoDoPessoal, textoDaAdmissao, textoDaDemissao, textoDasFerias,
  type PedidoDeAdmissao, type PedidoDeDemissao, type PedidoDeFerias,
} from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export type Pedido = 'admissao' | 'ferias' | 'demissao';
export type DadosDoPedido = PedidoDeAdmissao | PedidoDeFerias | PedidoDeDemissao;
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** 'aaaa-mm' → '10/2026' */
const mesBr = (c: string) => (c ? c.slice(5, 7) + '/' + c.slice(0, 4) : '');

export function useDp({ token, area, hoje }: DaCasca) {
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [mostrarSaidas, setMostrarSaidas] = useState(false);
  const meses = ac.mesesDosDocumentosDp(area.documentosDp);
  const [mesEscolhido, setMes] = useState('');
  const mes = meses.includes(mesEscolhido) ? mesEscolhido : meses[0] ?? '';
  const [baixando, setBaixando] = useState('');

  /** confere e manda o pedido como solicitação; devolve o erro em português, ou '' quando foi */
  async function pedir(pedido: Pedido, dados: DadosDoPedido): Promise<string> {
    const problema = pedido === 'admissao' ? erroDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? erroDasFerias(dados as PedidoDeFerias) : erroDaDemissao(dados as PedidoDeDemissao);
    if (problema) return problema;
    const texto = pedido === 'admissao' ? textoDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? textoDasFerias(dados as PedidoDeFerias) : textoDaDemissao(dados as PedidoDeDemissao);
    const foto = pedido === 'admissao' ? (dados as PedidoDeAdmissao).foto : undefined;
    try {
      const id = await repoAreaCliente.abrirChamado(token, { tipo: pedido, texto, ...(foto ? { foto } : {}) });
      if (!id) return 'Não deu para mandar o pedido. Tente de novo.';
    } catch (e) {
      // o banco recusou (link revogado) ou caiu a internet: a frase vem pronta do repositório
      return e instanceof Error ? e.message : 'Não deu para mandar o pedido. Tente de novo.';
    }
    toast('Pedido enviado ao escritório. Acompanhe em Solicitações.');
    return '';
  }

  async function baixar(id: string) {
    setBaixando(id);
    try {
      const r = await repoAreaCliente.baixarDocumentoDp(token, id);
      if (r) baixarArquivo(r.nome, r.arquivo); else toast('Não achamos este arquivo agora. Peça ao escritório em Solicitações.');
    } finally { setBaixando(''); }
  }

  const funcionarios = area.pessoal?.funcionarios ?? [];
  const nomeDe = new Map(funcionarios.map(f => [f.id, nomeDaPessoa(f.nome)]));
  const docsDe = (id: string) => area.documentosDp.filter(d => d.funcionario === id);
  /** um documento como a tela mostra: o nome, de quem, o mês e o tamanho, o ícone e se dá para baixar */
  const linhaDoDoc = (d: ac.DocumentoDoDp) => ({
    id: d.id, nome: d.nome, formato: formatoPeloNome(d.nome), dono: d.funcionario ? nomeDe.get(d.funcionario) ?? '' : '',
    detalhe: [mesBr(d.competencia), d.tamanho ? ac.tamanhoLegivel(d.tamanho) : ''].filter(Boolean).join(' · '), podeBaixar: d.partes > 0,
  });
  const b = sem(busca.trim());
  const visiveis = funcionarios.filter(f => (mostrarSaidas || f.ativo) && (!b || sem(f.nome + ' ' + f.cpf + ' ' + f.matricula).includes(b)));

  return {
    numeros: resumoDoPessoal(area.pessoal, hoje),
    competencia: mesBr(area.pessoal?.competencia ?? ''),
    temFuncionarios: funcionarios.length > 0,
    funcionarios: visiveis.map(f => ({
      id: f.id, nome: nomeDaPessoa(f.nome), cpf: f.cpf, matricula: f.matricula, desde: mesBr(f.desde), remuneracao: formatos.reais(f.remuneracao),
      ativo: f.ativo, situacao: f.ativo ? 'Ativo' : 'Saiu em ' + mesBr(f.ultimo), documentos: docsDe(f.id).length,
      /** os documentos dele, o mais novo primeiro (a ficha) */
      docs: docsDe(f.id).sort((x, y) => y.competencia.localeCompare(x.competencia)).map(linhaDoDoc),
    })),
    total: funcionarios.filter(f => mostrarSaidas || f.ativo).length,
    saidas: funcionarios.filter(f => !f.ativo).length,
    mostrarSaidas, alternarSaidas: () => setMostrarSaidas(v => !v),
    busca, mudarBusca: setBusca,
    // os documentos do mês, por categoria
    meses: meses.map(m => ({ valor: m, rotulo: formatos.capital(formatos.rot(m).toLowerCase()) })),
    mes, mudarMes: setMes,
    grupos: ac.documentosPorCategoria(area.documentosDp.filter(d => d.competencia === mes)).map(g => ({ categoria: g.categoria, rotulo: g.rotulo, docs: g.documentos.map(linhaDoDoc) })),
    baixar: (id: string) => { void baixar(id); }, baixando,
    // os pedidos
    pedir, nomes: funcionarios.filter(f => f.ativo).map(f => nomeDaPessoa(f.nome)).sort(),
    novaAdmissao: (): PedidoDeAdmissao => ({ nome: '', cpf: '', cargo: '', salario: '', inicio: '', contrato: 'Prazo indeterminado', observacoes: '' }),
    novasFerias: (empregado = ''): PedidoDeFerias => ({ empregado, inicio: '', dias: '30 dias', adiantar13: false, observacoes: '' }),
    novaDemissao: (empregado = ''): PedidoDeDemissao => ({ empregado, ultimoDia: '', motivo: '', aviso: 'Trabalhado', observacoes: '' }),
    dataBr,
  };
}
