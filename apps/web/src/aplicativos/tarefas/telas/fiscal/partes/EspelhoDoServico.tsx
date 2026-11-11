// O espelho da nota de serviço (11/11/2026: "a parte dos servicos tomados e prestados nao e clicavel"): a NFS-e do SIEG
// abre na mesma janela das notas (EspelhoDaNota), com o que o resumo guarda dela (core tarefas.sieg.espelhoDoServico):
// a chave (clicar copia), quem prestou e quem tomou, o valor, as retenções e o líquido, o NBS e a descrição do serviço.
// Só desenha: as contas estão no core.
import { tarefas as t } from '@nads/core';
import { BotaoFechar, Icone, Stat, useJanela, useRetorno } from '@nads/ui';
import { useRef } from 'react';
import { documentoFormatado } from '../../financeiro/formatosDaNota';
import { Propriedade } from '../../financeiro/partes/Propriedade';

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EspelhoDoServico({ nota, fechar }: { nota: t.sieg.NotaDoSieg; fechar: () => void }) {
  const e = t.sieg.espelhoDoServico(nota);
  const { toast } = useRetorno();
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  const copiar = () => { void navigator.clipboard?.writeText(nota.chave).then(() => toast('Chave copiada.'), () => toast('Não consegui copiar.')); };
  const parte = (p: { doc: string; nome: string }) => <span className="espelho-parte"><b>{p.nome || '—'}</b>{p.doc && <span className="fraco num"> · {documentoFormatado(p.doc)}</span>}</span>;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo espelho-nota" role="dialog" aria-modal="true" aria-label={'A nota ' + e.titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Nota de serviço<Icone nome="chevronRight" /><b>{e.titulo}</b>{nota.cancelada && <span className="badge badge-bad">Cancelada</span>}</span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo espelho-corpo">
          <div className="registro-props">
            {e.chave && (
              <Propriedade icone="hash" rotulo="Chave de acesso">
                <span className="espelho-chave"><button type="button" className="texto-copiavel num" title="Clique para copiar" onClick={copiar}>{e.chave}</button></span>
              </Propriedade>
            )}
            <Propriedade icone="predio" rotulo="Prestador">{parte(e.prestador)}</Propriedade>
            <Propriedade icone="usuario" rotulo="Tomador">{parte(e.tomador)}</Propriedade>
            {e.nbs && <Propriedade icone="hash" rotulo="NBS"><span className="num">{e.nbs}</span></Propriedade>}
            {e.descricao && <Propriedade icone="fileText" rotulo="Serviço"><span>{e.descricao}</span></Propriedade>}
          </div>

          <div className="stat-grid fin-numeros espelho-totais">
            <Stat grande={false} rotulo="Valor do serviço" valor={'R$ ' + brl(e.valor)} />
            <Stat grande={false} rotulo="Retenções" valor={'R$ ' + brl(e.retido)} />
            <Stat grande={false} rotulo="Líquido" valor={'R$ ' + brl(e.liquido)} />
          </div>

          {e.retencoes.length > 0 ? (
            <div className="table-wrap espelho-itens">
              <table className="table-compact">
                <thead><tr><th>Retenção</th><th className="num">Valor</th></tr></thead>
                <tbody>{e.retencoes.map(r => <tr key={r.imposto}><td>{r.imposto}</td><td className="num"><b>{brl(r.valor)}</b></td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="fraco">Sem retenções nesta nota.</p>}
        </div>
        <footer className="registro-pe">
          <span className="fraco">Os dados do resumo do SIEG</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
