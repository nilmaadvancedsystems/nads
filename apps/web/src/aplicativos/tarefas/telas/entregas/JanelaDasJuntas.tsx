// As paradas assinadas juntas (16/10/2026, a cópia fiel do Entregas): "Entregas incluídas" (cada uma com a competência,
// a empresa quando o lote mistura, os documentos com o valor e o total), "Cliente ausente / entrega não realizada", quem
// recebeu, a foto e a assinatura; no rodapé "Confirmar todas". O visual é o do nads.
import { BotaoAcao, CampoArquivos, CampoAssinatura, Icone } from '@nads/ui';
import type { entregas } from '@nads/core';
import { MolduraDaJanela } from './MolduraDaJanela';
import { useJanelaDasJuntas } from './useJanelaDasJuntas';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export function JanelaDasJuntas({ titulo, lista }: { titulo: string; lista: Entrega[] }) {
  const vm = useJanelaDasJuntas(titulo, lista);
  return (
    <MolduraDaJanela caminho="Rota" titulo={vm.titulo} sub={vm.sub} onFechar={vm.fechar} classe="ent-parada"
      rodape={<><span className="tarefas-barra-espaco" /><BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando…" onClick={() => void vm.confirmar()}>{vm.rotuloDoBotao}</BotaoAcao></>}>
      {vm.dica && <p className="registro-dica"><Icone nome="lampada" />{vm.dica}.</p>}
      <div className="field">
        <label>Entregas incluídas</label>
        <ul className="ent-lote">
          {vm.linhas.map(l => (
            <li key={l.e.id}>
              <label className="ent-lote-linha">
                <input type="checkbox" checked={l.marcada} onChange={() => vm.alternar(l.e.id)} />
                <span><b>{l.competencia}</b>{l.empresa && <span className="fraco"> {l.empresa}</span>}
                  <span className="ent-fichas">{l.fichas.map((f, i) => <span key={i} className="badge badge-neutral">{f}</span>)}</span>
                  {l.total && <span className="hint">{l.total}</span>}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <label className="ent-marca ent-marca-falha"><input type="checkbox" checked={vm.falha} onChange={e => vm.setFalha(e.target.checked)} /><Icone nome="alert" />Cliente ausente / entrega não realizada</label>
      {vm.falha && (
        <div className="field">
          <label htmlFor="ent-lote-falha">O que aconteceu</label>
          <div className="ent-motivos">{vm.motivos.map(m => <button key={m} type="button" className={'chip-f' + (vm.motivoMarcado === m ? ' on' : '')} onClick={() => vm.usarMotivo(m)}>{m}</button>)}</div>
          <textarea id="ent-lote-falha" rows={2} value={vm.motivoFalha} onChange={e => vm.setMotivoFalha(e.target.value)} placeholder="Ex.: Estabelecimento fechado, ninguém atendeu..." />
          {vm.erros.motivo && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.motivo}</p>}
        </div>
      )}
      {!vm.falha && (
        <div className="field">
          <label htmlFor="ent-lote-receb">Nome de quem recebeu (opcional)</label>
          <input id="ent-lote-receb" type="text" value={vm.recebedor} onChange={e => vm.setRecebedor(e.target.value)} placeholder="Quem assinou pelo cliente" />
          {vm.sugeridos.length > 0 && <div className="ent-motivos">{vm.sugeridos.map(n => <button key={n} type="button" className="chip-f" onClick={() => vm.setRecebedor(n)}>{n}</button>)}</div>}
        </div>
      )}
      <div className="field">
        <label>{vm.rotuloDaFoto}</label>
        {vm.foto ? (
          <span className="ent-anexo"><img className="ent-foto" src={vm.foto} alt="Foto anexada" /><button type="button" className="btn btn-ghost" onClick={vm.tirarFoto}><Icone nome="x" />Remover foto</button></span>
        ) : <CampoArquivos id="ent-lote-foto" aceitar="image/*" camera rotulo="Tirar foto / anexar" onEscolher={fs => void vm.anexarFoto(fs)} />}
        {vm.erros.foto && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.foto}</p>}
      </div>
      {!vm.falha && (
        <div className="field">
          <label>Assinatura (opcional se anexar foto)</label>
          <CampoAssinatura valor={vm.assinatura} onMudar={vm.setAssinatura} altura={200} telaCheia rotulo="Assinatura de quem recebeu" textoPronta="Assinatura capturada." />
          {vm.erros.assinatura && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.assinatura}</p>}
        </div>
      )}
    </MolduraDaJanela>
  );
}
