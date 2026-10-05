// O "Arquivar agora" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha — pelo
// botão ou a organização das 9h) abre a janela flutuante do arquivador (JanelaDoArquivador).
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
        title="Organizar a pasta Claudio Secretario (cada arquivo vai para a pasta do cliente), ver a organização em andamento, a conversa do Claude e o relatório">
        <Icone nome={vm.ocupado ? 'girar' : 'arquivo'} />{vm.rotulo}
      </button>
      {aberta && <JanelaDoArquivador vm={vm} fechar={() => setAberta(false)} />}
    </>
  );
}
