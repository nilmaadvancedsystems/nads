// A janela de enviar o holerite ou o comprovante de uma pessoa (12/11/2026): o arquivo (PDF ou imagem, até 10 MB), o mês e
// o valor líquido (o holerite) ou pago (o comprovante), que vira o "Salário" da Visão geral dela. Só o Financeiro.
import { carteira } from '@nads/core';
import { BotaoFechar, CampoArquivos, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { tamanhoBr } from './comum';
import { useJanelaDoDocumento } from './useCarteiraDaPessoa';

export function JanelaDoDocumento({ para, competencia, fechar }: { para: { uid: string; nome: string; tipo: carteira.TipoDeDocumento }; competencia: string; fechar: () => void }) {
  const vm = useJanelaDoDocumento(para, competencia, fechar);
  const { arquivo, valor, setValor, erro, enviando } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const titulo = carteira.rotuloDoDocumento(para.tipo) + ' de ' + para.nome;

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !enviando) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="upload" />Carteira<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} disabled={enviando} />
        </header>
        <div className="registro-corpo">
          <div className="registro-props">
            <Propriedade icone="calendar" rotulo="Mês"><span>{carteira.mesPorExtenso(competencia)}</span></Propriedade>
            <Propriedade icone="fileText" rotulo="Arquivo">
              {arquivo ? <span className="cart-arquivo-escolhido"><Icone nome="clipe" />{arquivo.nome} · {tamanhoBr(arquivo.bytes.length)}<button type="button" className="btn btn-ghost btn-sm" onClick={vm.tirarArquivo}>Trocar</button></span>
                : <CampoArquivos id="cart-documento" aceitar=".pdf,.png,.jpg,.jpeg" rotulo="Escolher o arquivo" onEscolher={fs => void vm.escolher(fs[0])} />}
            </Propriedade>
            <Propriedade icone="dinheiro" rotulo={para.tipo === 'holerite' ? 'Líquido' : 'Valor pago'}>
              <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Opcional" aria-label={para.tipo === 'holerite' ? 'Valor líquido do holerite' : 'Valor pago'} />
            </Propriedade>
          </div>
          {para.tipo === 'holerite' && <p className="registro-dica"><Icone nome="recibo" />O líquido do holerite aparece como o Salário do mês na Carteira da pessoa.</p>}
          {erro && <ul className="registro-erros"><li><Icone nome="alert" />{erro}</li></ul>}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" disabled={enviando} onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={enviando || !arquivo} onClick={() => void vm.enviar()}><Icone nome="upload" />{enviando ? 'Enviando…' : 'Enviar'}</button>
        </footer>
      </div>
    </div>
  );
}
