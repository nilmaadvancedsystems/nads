// Incluir, editar e encerrar uma conta bancária numa janela no centro da tela, por cima de tudo (Vitor, 06/11/2026: no
// balão, clicar fora fechava e perdia o que estava escolhendo). Clicar fora não fecha: só o ✕ (ou o Esc).
import type { empresas } from '@nads/core';
import { BotaoFechar, Esqueleto, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { LinhaConta, VmContasBancarias } from '../useContasBancarias';
import { FormConta, FormEncerrar } from './FormConta';

/** o que a janela abre: uma conta nova (com inicial = veio de uma sugestão do robô, com o banco já escolhido), editar ou encerrar */
export type JanelaAberta =
  | { modo: 'nova'; inicial?: empresas.cadastro.DadosDaConta }
  | { modo: 'editar' | 'encerrar'; linha: LinhaConta };

const conta = (l: LinhaConta) => [l.nome, l.conta].filter(Boolean).join(' · ');

export function JanelaDaConta({ vm, aberta, fechar }: { vm: VmContasBancarias; aberta: JanelaAberta; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = aberta.modo === 'nova' ? 'Nova conta' : (aberta.modo === 'editar' ? 'Editar · ' : 'Encerrar · ') + conta(aberta.linha);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal cad-janela-conta" role="dialog" aria-modal="true" aria-label={titulo}>
        <h3 className="pedir-titulo">{titulo}<BotaoFechar className="pedir-x" onClick={fechar} /></h3>
        <div className="cad-janela-conta-corpo">
          {aberta.modo === 'nova'
            ? (vm.carregando ? <Esqueleto linhas={2} /> : <FormConta vm={vm} id={null} inicial={aberta.inicial} fechar={fechar} />)
            : aberta.modo === 'editar'
              ? <FormConta vm={vm} id={aberta.linha.id} inicial={aberta.linha.dados} fechar={fechar} />
              : <FormEncerrar vm={vm} id={aberta.linha.id} fechar={fechar} />}
        </div>
      </div>
    </div>
  );
}
