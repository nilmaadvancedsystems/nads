// ViewModel do Departamento pessoal (Vitor, 16/10/2026, a "Gestão de empregados" do protótipo): os quatro números (ativos,
// de férias, folha bruta e admissões no ano), a tabela dos funcionários com a busca, e os pedidos de admissão, férias e
// demissão. Por enquanto cada pedido vira um chamado do tipo certo com os dados no texto (na admissão, a foto vai junto).
// A foto de cada funcionário (Vitor, 16/10/2026): o navegador recorta e reduz (partes/foto.ts) e o repositório envia.
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { ROTULO_DAS_FERIAS, type Empregado } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';
import { fotoQuadrada, urlDaFoto } from '../partes/foto';
import {
  dataBr, erroDaAdmissao, erroDaDemissao, erroDasFerias, resumoDoPessoal, textoDaAdmissao, textoDaDemissao, textoDasFerias,
  type PedidoDeAdmissao, type PedidoDeDemissao, type PedidoDeFerias,
} from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export type Pedido = 'admissao' | 'ferias' | 'demissao';
export type DadosDoPedido = PedidoDeAdmissao | PedidoDeFerias | PedidoDeDemissao;
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useDp({ token, area, hoje }: DaCasca) {
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  // o id do funcionário cuja foto está indo agora
  const [enviandoFoto, setEnviandoFoto] = useState('');

  /** confere e manda o pedido como chamado; devolve o erro em português, ou '' quando foi */
  async function pedir(pedido: Pedido, dados: DadosDoPedido): Promise<string> {
    const problema = pedido === 'admissao' ? erroDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? erroDasFerias(dados as PedidoDeFerias) : erroDaDemissao(dados as PedidoDeDemissao);
    if (problema) return problema;
    const texto = pedido === 'admissao' ? textoDaAdmissao(dados as PedidoDeAdmissao) : pedido === 'ferias' ? textoDasFerias(dados as PedidoDeFerias) : textoDaDemissao(dados as PedidoDeDemissao);
    const foto = pedido === 'admissao' ? (dados as PedidoDeAdmissao).foto : undefined;
    const id = await repoAreaCliente.abrirChamado(token, { tipo: pedido, texto, ...(foto ? { foto } : {}) });
    if (!id) return 'Não deu para mandar o pedido. Tente de novo.';
    toast('Pedido enviado ao escritório. Acompanhe em Solicitações e chamados.');
    return '';
  }

  const b = sem(busca.trim());
  const empregados = [...area.empregados].sort((x, y) => x.nome.localeCompare(y.nome)).filter(e => !b || sem(e.nome + ' ' + e.cargo + ' ' + e.cpf).includes(b));
  /** prepara e envia a foto do funcionário; devolve a foto nova (data URL), ou null quando não deu */
  async function trocarFoto(e: Empregado, arquivo: File): Promise<string | null> {
    setEnviandoFoto(e.id);
    try {
      const b64 = await fotoQuadrada(arquivo);
      await repoAreaCliente.enviarFotoDoFuncionario(token, e.id, b64);
      toast(e.foto ? 'Foto trocada.' : 'Foto adicionada.');
      return urlDaFoto(b64);
    } catch (erro) {
      toast(erro instanceof Error ? erro.message : 'Não deu para enviar a foto. Tente de novo.');
      return null;
    } finally { setEnviandoFoto(''); }
  }

  return {
    trocarFoto, enviandoFoto,
    numeros: resumoDoPessoal(area.empregados, hoje),
    empregados, total: area.empregados.length, nomes: area.empregados.map(e => e.nome).sort(),
    busca, mudarBusca: setBusca, pedir,
    novaAdmissao: (): PedidoDeAdmissao => ({ nome: '', cpf: '', cargo: '', salario: '', inicio: '', contrato: 'Prazo indeterminado', observacoes: '' }),
    novasFerias: (empregado = ''): PedidoDeFerias => ({ empregado, inicio: '', dias: '30 dias', adiantar13: false, observacoes: '' }),
    novaDemissao: (empregado = ''): PedidoDeDemissao => ({ empregado, ultimoDia: '', motivo: '', aviso: 'Trabalhado', observacoes: '' }),
    iniciais: (nome: string) => nome.split(/\s+/).filter(Boolean).map(p => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase(),
    rotuloDasFerias: (e: Empregado) => e.ferias === 'em ferias' && e.retornoEm ? 'De férias até ' + dataBr(e.retornoEm) : ROTULO_DAS_FERIAS[e.ferias],
    seloDasFerias: (e: Empregado) => ({ 'em dia': 'badge badge-ok', 'em ferias': 'badge badge-warn', 'periodo aquisitivo': 'badge badge-neutral', vencidas: 'badge badge-bad' })[e.ferias],
    dataBr, reais: formatos.reais,
  };
}
