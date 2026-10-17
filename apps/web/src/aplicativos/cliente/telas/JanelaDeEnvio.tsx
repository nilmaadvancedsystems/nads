// A janela "Enviar documento" da Área do Cliente (Vitor, 16/10/2026): a mesma da Central de documentos. Com o banco, a
// Central ainda não tem documentos do escritório e fica escondida (17/10/2026); o envio continua no topo, em Solicitações
// e no número "Arquivos enviados" da Visão geral, e todos abrem esta janela.
import { useRetorno } from '@nads/ui';
import { Enviar } from './Enviar';
import type { DaCasca } from './useAreaCliente';

export function useJanelaDeEnvio(props: DaCasca): () => void {
  const { modal } = useRetorno();
  return () => void modal({
    titulo: 'Enviar documento', texto: 'Extratos, notas, comprovantes ou outro documento para o escritório.',
    corpo: <div className="cli-app cli-janela"><Enviar {...props} /></div>,
    botoes: [{ rotulo: 'Fechar', valor: null, variante: 'btn-outline' }],
  });
}
