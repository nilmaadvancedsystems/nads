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
  // as guias que o cliente abriu pelo link desta empresa (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura)
  const leituras = repo.leituras();
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
    /** as guias abertas pelo cliente, a mais recente primeiro ("DAS 10/2026 · aberta em 18/11 às 09:12") (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura) */
    guiasAbertas: {
      erro: leituras.erro && /permission|insufficient/i.test(leituras.erro) ? 'O banco ainda não deixa ver quais guias o cliente abriu (falta a regra do Vitor).' : leituras.erro ? 'Não consegui ler as guias abertas.' : '',
      lista: link ? leituras.lista.filter(l => l.token === link.token).slice(0, 8).map(l => {
        const d = new Date(l.primeiraEm);
        const quando = Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const mes = /^\d{4}-\d{2}$/.test(l.competencia) ? ' ' + l.competencia.slice(5) + '/' + l.competencia.slice(0, 4) : '';
        return { chave: l.guiaId, rotulo: (l.tipo || 'Guia') + mes, quando: 'aberta em ' + quando + (l.vezes > 1 ? ' (' + l.vezes + ' vezes)' : '') };
      }) : [],
    },
  };
}
