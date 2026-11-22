// A janela "Enviar documento" da Área do Cliente (Vitor, 16/10/2026): a mesma da Central de documentos. Com o banco, a
// Central ainda não tem documentos do escritório e fica escondida (17/10/2026); o envio continua no topo, em Solicitações
// e no número "Arquivos enviados" da Visão geral, e todos abrem esta janela.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { Enviar } from './Enviar';
import type { DaCasca } from './useAreaCliente';

export function useJanelaDeEnvio(props: DaCasca): () => void {
  const { modal } = useRetorno();
  return () => void modal({
    titulo: 'Enviar documento', texto: 'Extratos, notas, comprovantes ou outro documento para o escritório.',
    corpo: <div className="cli-app cli-janela cli-janela-envio"><Enviar {...props} /></div>,
    // só o × no canto (12/11/2026: o "Fechar" embaixo repetia o ×)
    botoes: [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }],
  });
}

/** A mesma janela, já no tipo do documento que falta (o aviso "Falta mandar" do sino) (plano do Acessórias, 17/11/2026, fichas o-que-falta-mandar e pedidos-do-mandei; frase do dono: "No sino"). */
export function useJanelaDeEnvioDoTipo(props: DaCasca): (tipo: ac.TipoDeEnvio) => void {
  const { modal } = useRetorno();
  return tipo => void modal({
    titulo: 'Enviar documento', texto: 'O escritório está esperando este documento.',
    corpo: <div className="cli-app cli-janela cli-janela-envio"><Enviar {...props} inicial={{ tipo }} /></div>,
    botoes: [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }],
  });
}

/**
 * "Já paguei: mandar o comprovante" (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia, parte A): a mesma janela, com o tipo Comprovante marcado e o nome
 * do arquivo saindo com o prefixo da guia. A guia NÃO vira paga: a linha só diz "Comprovante enviado em dd/mm".
 */
export function useJanelaDoComprovante(props: DaCasca): (g: ac.GuiaDoCliente) => void {
  const { modal } = useRetorno();
  return g => void modal({
    titulo: 'Mandar o comprovante', texto: 'Anexe o comprovante de pagamento (PDF ou foto). O nome da guia vai junto.',
    corpo: <div className="cli-app cli-janela cli-janela-envio"><Enviar {...props} inicial={{ tipo: 'comprovante', prefixo: ac.prefixoDoComprovante(g) }} /></div>,
    botoes: [{ rotulo: 'Voltar', valor: null, variante: 'btn-outline' }],
  });
}

/**
 * O que falta mandar (22/11/2026, Documentos do cliente; o dono: "vamos continuar e terminar as funcionalidades"): a mesma
 * janela, no tipo do documento (a aplicação leva o prefixo "Aplicação" no nome, para o robô baixar a pendência certa), com o
 * botão "Não tive movimento em <mês>". Devolve true quando o cliente escolheu o "sem movimento".
 */
export function useJanelaDaPendencia(props: DaCasca): (p: { tipo: ac.TipoDeEnvio; prefixo?: string; mes: string }, titulo: string) => Promise<boolean> {
  const { modal } = useRetorno();
  return async (p, titulo) => {
    const r = await modal({
      titulo, texto: 'Mande o arquivo por aqui. Se não houve movimento em ' + p.mes + ', é só avisar.',
      corpo: <div className="cli-app cli-janela cli-janela-envio"><Enviar {...props} inicial={{ tipo: p.tipo, ...(p.prefixo ? { prefixo: p.prefixo } : {}) }} /></div>,
      botoes: [{ rotulo: 'Não tive movimento em ' + p.mes, valor: 'sem', variante: 'btn-outline' }, { rotulo: 'Voltar', valor: null, variante: 'btn-outline' }],
    });
    return r === 'sem';
  };
}
