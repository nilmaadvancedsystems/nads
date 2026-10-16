// ViewModel do bloco "Link do cliente" da janela da empresa (Vitor, 16/10/2026): o link da empresa e as ações sobre ele.
import { enderecoDoLink } from '../../dados/areaCliente';
import { useAreaCliente } from '../../dados/repo';
import { useAcoesDoLink } from './useAcoesDoLink';

export function useLinkDaEmpresa(codigo: number) {
  const lista = useAreaCliente().links();
  const acoes = useAcoesDoLink();
  const link = lista.lista.find(l => l.codigo === codigo);
  return {
    acoes,
    link,
    carregando: !lista.carregada,
    endereco: link ? enderecoDoLink(link.token) : '',
    data: link?.atualizadoEm ? new Date(link.atualizadoEm).toLocaleDateString('pt-BR') : '',
  };
}
