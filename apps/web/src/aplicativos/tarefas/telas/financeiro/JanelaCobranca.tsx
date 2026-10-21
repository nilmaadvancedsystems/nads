// A janela Cobrar (21/10/2026, Honorários): a mensagem pronta (editável), o telefone do cliente e os botões Abrir no
// WhatsApp e Copiar mensagem. Mandar registra a cobrança do mês no contrato.
import { financeiro } from '@nads/core';
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { Propriedade } from './partes/Propriedade';
import { useJanelaCobranca } from './useJanelaCobranca';

export function JanelaCobranca({ contratoId, competencia, fechar }: { contratoId: string; competencia: string; fechar: () => void }) {
  const vm = useJanelaCobranca(contratoId, competencia, fechar);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  if (!vm.contrato) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Cobrar honorário">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="mensagem" />Honorários<Icone nome="chevronRight" /><b>Cobrar {financeiro.competenciaBr(competencia)}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">
          <div className="registro-busca"><Icone nome="briefcase" /><span className="nf-escolhido"><b>{vm.contrato.codigo || '—'}</b> · {vm.contrato.nome}</span></div>
          <div className="registro-props">
            <Propriedade icone="mensagem" rotulo="WhatsApp">
              <input type="text" inputMode="tel" value={vm.fone} onChange={e => vm.setFone(e.target.value)} placeholder={vm.lendo ? 'Procurando o número…' : 'Digite o número com o DDD'} aria-label="WhatsApp do cliente" />
            </Propriedade>
          </div>
          <textarea className="fin-cobranca-texto" rows={7} value={vm.texto} onChange={e => vm.setTexto(e.target.value)} aria-label="Mensagem de cobrança" />
          {!vm.temPix && <p className="registro-dica"><Icone nome="ajuda" />O escritório não tem chave PIX cadastrada: a mensagem vai sem a linha da chave.</p>}
          {!vm.link && !vm.lendo && <p className="registro-dica"><Icone nome="alert" />Digite o número do cliente com o DDD para abrir o WhatsApp.</p>}
        </div>
        <footer className="registro-pe">
          {vm.editado && <button type="button" className="btn btn-outline" onClick={vm.voltarAoModelo}><Icone nome="repeat" />Voltar ao modelo</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.copiar}><Icone nome="copiar" />Copiar mensagem</button>
          {vm.link
            ? <a className="btn btn-primary" href={vm.link} target="_blank" rel="noopener noreferrer" onClick={vm.aoAbrirWhatsapp}><Icone nome="mensagem" />Abrir no WhatsApp</a>
            : <button type="button" className="btn btn-primary" disabled><Icone nome="mensagem" />Abrir no WhatsApp</button>}
        </footer>
      </div>
    </div>
  );
}
