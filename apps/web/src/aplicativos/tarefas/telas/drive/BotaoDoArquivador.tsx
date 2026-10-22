// O "Arquivar agora" na barra do Drive: o botão (que vira "Organizando 45%" enquanto o arquivador trabalha — pelo
// botão ou a organização das 9h) abre a janela flutuante do arquivador (JanelaDoArquivador). Com ?arquivador=historico no
// endereço (o "Abrir o histórico do Arquivador" do Painel do robô, 21/10/2026), a janela já abre (no Agora, o único tópico desde 22/10/2026).
import { Icone } from '@nads/ui';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { JanelaDoArquivador } from './JanelaDoArquivador';
import { useArquivadorDoDrive } from './useArquivadorDoDrive';

export function BotaoDoArquivador() {
  const vm = useArquivadorDoDrive();
  const [params, setParams] = useSearchParams();
  const pedida = params.get('arquivador');
  const [aberta, setAberta] = useState(pedida === 'historico');
  const fechar = () => {
    setAberta(false);
    // sem o ?arquivador no endereço, a janela não abre de novo sozinha ao recarregar
    if (pedida) setParams(p => { const n = new URLSearchParams(p); n.delete('arquivador'); return n; }, { replace: true });
  };
  if (!vm.visivel) return null;
  return (
    <>
      <button type="button" className={'btn btn-outline arquivador-btn' + (vm.ocupado ? ' ocupado' : '')} onClick={() => setAberta(true)}
        title="Organizar a pasta Claudio Secretario (cada arquivo vai para a pasta do cliente), ver a organização em andamento, a conversa do Claude e o relatório">
        <Icone nome={vm.ocupado ? 'girar' : 'arquivo'} />{vm.rotulo}
      </button>
      {aberta && <JanelaDoArquivador vm={vm} fechar={fechar} />}
    </>
  );
}
