// ViewModel da proteção do login: se este login precisa ser liberado (proteção ligada, não é admin, ainda não
// liberado), o pedido e o código; e, para o admin, os pedidos esperando (aprovar mostra o código para passar à pessoa).
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useAcesso } from '../../dados/repo';

export function useLiberacao(admin: boolean) {
  const repo = useAcesso();
  const { toast } = useRetorno();
  const config = repo.config();
  const sessao = repo.minhaSessao();
  const pedido = repo.meuPedido();
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  return {
    /** ainda sabendo se precisa */
    carregando: !config.carregada || (config.protecao && !admin && !sessao.carregada),
    precisa: config.protecao && !admin && sessao.carregada && !sessao.liberada,
    pedido,
    codigo,
    setCodigo: (v: string) => { setErro(''); setCodigo(usuarios.codigoDigitado(v)); },
    enviando,
    erro,
    async pedir() {
      setEnviando(true);
      try { await repo.pedir(usuarios.computadorDoNavegador(navigator.userAgent)); } catch (err) { toast('Não consegui pedir: ' + (err as Error).message); } finally { setEnviando(false); }
    },
    async confirmar() {
      if (codigo.length !== 6) { setErro('O código tem 6 números.'); return; }
      setEnviando(true);
      try { await repo.confirmar(codigo); } catch { setErro('Código errado. Confira com quem liberou.'); } finally { setEnviando(false); }
    },
  };
}

export function useAvisosDeLiberacao(admin: boolean) {
  const repo = useAcesso();
  const { toast } = useRetorno();
  const [codigos, setCodigos] = useState<{ nome: string; computador: string; codigo: string }[]>([]);
  return {
    pendentes: admin ? repo.pendentes() : [],
    codigos,
    async aprovar(p: usuarios.PedidoDeLiberacao) {
      try {
        const codigo = await repo.aprovar(p);
        setCodigos(l => [...l, { nome: p.nome, computador: p.computador, codigo }]);
      } catch (err) { toast('Não consegui aprovar: ' + (err as Error).message); }
    },
    async recusar(p: usuarios.PedidoDeLiberacao) {
      try { await repo.recusar(p); toast('Pedido de ' + p.nome + ' recusado.'); } catch (err) { toast('Não consegui recusar: ' + (err as Error).message); }
    },
    fecharCodigo: (codigo: string) => setCodigos(l => l.filter(c => c.codigo !== codigo)),
  };
}
