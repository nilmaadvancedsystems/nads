// O "Arquivador" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha — pelo
// pedido ou a organização das 9h) abre o painel de progresso do arquivador (JanelaDoArquivador; 22/10/2026).
// O resto do arquivador (o que chegou, o que foi arquivado e por quê, o que ficou para resolver, os erros) mora desde
// 22/10/2026 numa área só, no site do admin (Admin › Arquivador); a janela leva o admin para lá.
import { Icone } from '@nads/ui';
import { useState } from 'react';
import { JanelaDoArquivador } from './JanelaDoArquivador';
import { useArquivadorDoDrive } from './useArquivadorDoDrive';

export function BotaoDoArquivador() {
  const vm = useArquivadorDoDrive();
  const [aberta, setAberta] = useState(false);
  if (!vm.visivel) return null;
  return (
    <>
      <button type="button" className={'btn btn-outline arquivador-btn' + (vm.ocupado ? ' ocupado' : '')} onClick={() => setAberta(true)}
        title="Ver o andamento da organização da pasta Claudio Secretario">
        <Icone nome={vm.ocupado ? 'girar' : 'arquivo'} />{vm.rotulo}
      </button>
      {aberta && <JanelaDoArquivador vm={vm} fechar={() => setAberta(false)} />}
    </>
  );
}
