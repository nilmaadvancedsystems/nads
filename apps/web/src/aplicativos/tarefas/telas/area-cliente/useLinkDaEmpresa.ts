// ViewModel do bloco "Link do cliente" da janela da empresa (Vitor, 16/10/2026): o link da empresa e as ações sobre ele.
import { enderecoDoLink } from '../../dados/areaCliente';
import { useAreaCliente } from '../../dados/repo';
import { useAcoesDoLink } from './useAcoesDoLink';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { logoParaGravar } from './logoDaEmpresa';

export function useLinkDaEmpresa(codigo: number) {
  const repo = useAreaCliente();
  const lista = repo.links();
  const logos = repo.logos();
  const acoes = useAcoesDoLink();
  const { toast } = useRetorno();
  const [gravandoLogo, setGravandoLogo] = useState(false);
  const link = lista.lista.find(l => l.codigo === codigo);
  // a logo da empresa no topo da Área do Cliente (12/11/2026): o admin e os diretores mandam ou tiram
  const logo = logos.lista.find(l => l.codigo === codigo)?.logo ?? '';
  async function comLogo(f: () => Promise<void>, falhou: string) {
    setGravandoLogo(true);
    try { await f(); } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(/permission|insufficient/i.test(msg) ? 'O banco ainda não aceita a logo (falta publicar a regra nova). Avise o Vitor.' : falhou + ' ' + msg);
    } finally { setGravandoLogo(false); }
  }
  return {
    logo, gravandoLogo, erroDasLogos: logos.erro,
    enviarLogo: (arquivo: File) => void comLogo(async () => {
      const r = await logoParaGravar(arquivo);
      if ('erro' in r) { toast(r.erro); return; }
      await repo.gravarLogo(codigo, r.logo);
      toast('Logo gravada. A Área do Cliente mostra em alguns minutos.');
    }, 'Não deu para gravar a logo.'),
    tirarLogo: () => void comLogo(async () => { await repo.apagarLogo(codigo); toast('Logo tirada.'); }, 'Não deu para tirar a logo.'),
    acoes,
    link,
    carregando: !lista.carregada,
    endereco: link ? enderecoDoLink(link.token) : '',
    data: link?.atualizadoEm ? new Date(link.atualizadoEm).toLocaleDateString('pt-BR') : '',
  };
}
