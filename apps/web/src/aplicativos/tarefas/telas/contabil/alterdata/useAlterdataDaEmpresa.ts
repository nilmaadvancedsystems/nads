// ViewModel da página Alterdata da empresa aberta (Vitor, 04/11/2026: "quero criar um robo que puxa balancete e planilha de
// conta e upa no nads"; o lugar: a página da empresa). O mês na barra e o Pedir ao robô; a tabela dos pedidos da empresa
// (o mais novo em cima), cada um com a situação ao vivo (na fila com a posição, com o robô com o último passo, pronto, erro)
// e o Baixar do balancete e do razão. Pedidos ao mesmo tempo: o mesmo mês já na fila não entra de novo; os outros esperam
// a vez (o Contábil do robô é uma tela só). O aviso quando o Contábil do servidor não está aberto e logado.
import { empresas, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useAlterdata, useRepo } from '../../../dados/repo';
import { pedidoAndando, tipoDoArquivo, type PedidoMensalDoAlterdata, type RelatorioDoAlterdata } from '../../../dados/alterdata';

export type SituacaoDoPedido = 'fila' | 'trabalhando' | 'pronto' | 'parcial' | 'erro' | 'cancelado';

/** O Contábil de uma máquina vale se foi visto há menos de 5 min (o robô verifica a cada minuto). */
const VALE_MS = 5 * 60 * 1000;

export function situacaoDo(p: PedidoMensalDoAlterdata): SituacaoDoPedido {
  if (p.status === 'pendente') return 'fila';
  if (p.status === 'trabalhando') return 'trabalhando';
  if (p.status === 'cancelado') return 'cancelado';
  if (p.status === 'pronto') return Object.values(p.arquivos).some(a => a?.status === 'erro') ? 'parcial' : 'pronto';
  return 'erro';
}

export function useAlterdataDaEmpresa() {
  const repo = useRepo();
  const alt = useAlterdata();
  const { toast } = useRetorno();
  const { empresa: rota = '' } = useParams();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  const codigo = empresa?.codigo != null ? Number(empresa.codigo) : null;
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  // o que cada botão está fazendo ("pedir", "cancelar:<id>", "baixar:<id>:<rel>"): o dele mostra que trabalha e trava
  const [fazendo, setFazendo] = useState('');

  const daEmpresa = codigo != null ? alt.pedidos(codigo) : { carregados: true, lista: [] };
  const fila = alt.fila();
  const robo = alt.robo();
  const lista = daEmpresa.lista;
  const andandoNoMes = pedidoAndando(lista, competencia);
  const agora = Date.now();
  const vistas = robo.maquinas.filter(m => agora - Date.parse(m.em || '') < VALE_MS);

  const comFazendo = async (chave: string, f: () => Promise<void>) => {
    setFazendo(chave);
    try { await f(); } finally { setFazendo(''); }
  };

  return {
    empresa,
    carregando: !daEmpresa.carregados,
    competencia,
    setCompetencia,
    rotuloCompetencia: t.rotuloCompetencia(competencia),
    lista,
    andandoNoMes,
    fazendo,
    /** o Contábil do robô: pronto (alguma máquina com ele aberto e logado), ou o motivo de não estar */
    robo: {
      carregado: robo.carregado,
      pronto: vistas.some(m => m.contabil === 'ok'),
      motivo: !vistas.length ? 'O robô do servidor não deu sinal nos últimos minutos.'
        : vistas.some(m => m.contabil === 'login') ? 'O Contábil do servidor está na tela de login.'
          : vistas.some(m => m.contabil === 'dois') ? 'O Contábil do servidor está aberto duas vezes.'
            : 'O Contábil do servidor está fechado.',
    },
    /** a posição na fila do robô (1 = o próximo; 0 = fora da fila), contando os pedidos de todas as empresas */
    posicao: (p: PedidoMensalDoAlterdata) => fila.ids.indexOf(p.id) + 1,
    async pedir() {
      if (codigo == null || !empresa) return;
      if (andandoNoMes) { toast(t.rotuloCompetencia(competencia) + ' já está na fila do robô.'); return; }
      await comFazendo('pedir', async () => {
        try { await alt.pedir({ codigo, empresa: empresa.nome, competencia }); }
        catch (e) { toast('Não consegui pedir: ' + (e instanceof Error ? e.message : String(e))); }
      });
    },
    async cancelar(p: PedidoMensalDoAlterdata) {
      await comFazendo('cancelar:' + p.id, async () => {
        try { await alt.cancelar(p.id); }
        catch (e) { toast('Não consegui cancelar: ' + (e instanceof Error ? e.message : String(e))); }
      });
    },
    async baixar(p: PedidoMensalDoAlterdata, rel: RelatorioDoAlterdata) {
      await comFazendo('baixar:' + p.id + ':' + rel, async () => {
        try {
          const a = await alt.arquivo(p, rel);
          if (!a) { toast('Esse arquivo não saiu.'); return; }
          baixarBytes(a.bytes, a.nome, tipoDoArquivo(a.nome));
        } catch (e) { toast('Não consegui baixar: ' + (e instanceof Error ? e.message : String(e))); }
      });
    },
  };
}

export type VmAlterdataDaEmpresa = ReturnType<typeof useAlterdataDaEmpresa>;
