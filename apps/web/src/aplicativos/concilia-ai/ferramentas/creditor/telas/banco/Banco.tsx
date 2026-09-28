// Etapa 1 do Creditor: o relatório de liquidação do banco (PDF, planilha ou texto colado).
import { creditor as cr } from '@nads/core';
import { Alerta, CampoArquivo, Icone } from '@nads/ui';
import { useBanco } from './useBanco';

export function Banco() {
  const vm = useBanco();
  return (
    <section>
      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="landmark" /></span>Arquivo do banco</h3>
        <div className="import-box-row">
          <CampoArquivo id="fBanco" arquivo={null} aceitar={vm.aceitar} onEscolher={f => { void vm.escolherArquivo(f); }} />
        </div>
        <p className="hint">PDF exportado pelo banco (com texto), .xls, .xlsx ou .csv. A leitura acontece aqui no navegador: nada sai da máquina.</p>
        {vm.lendo && <p className="hint" style={{ marginTop: 8 }}>Lendo…</p>}
        {vm.erro && <Alerta titulo="Não foi possível ler o relatório" texto={vm.erro} onFechar={vm.fecharErro} />}
      </div>

      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="fileText" /></span>Ou cole o texto do relatório</h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>Abra o PDF, selecione tudo (Ctrl+A), copie e cole aqui. Uma linha do relatório por linha.</p>
        <textarea className="campo-texto" rows={8} value={vm.texto} onChange={e => vm.setTexto(e.target.value)} placeholder="Sacado  Nosso Número  Seu Número  Valor (R$)  Vlr. Mora  …" spellCheck={false} />
        <div className="btn-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button className="btn btn-outline" type="button" disabled={!vm.texto.trim()} onClick={vm.lerTexto}>Ler texto</button>
          <button className="btn btn-ghost" type="button" onClick={vm.exemplo}>Testar com o exemplo</button>
        </div>
      </div>

      <div className="card">
        <h3><span className="import-card-ico"><Icone nome="alert" /></span>Só tem foto?</h3>
        <p className="hint" style={{ marginTop: 0 }}>Foto não dá para ler aqui com segurança (dígito em ângulo vira erro). Peça o PDF ao banco, ou digite os títulos na conferência: cada grupo só passa se bater com o total impresso.</p>
        <div className="btn-row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button className="btn btn-outline" type="button" onClick={vm.emBranco}>Digitar os títulos</button>
        </div>
      </div>

      {vm.lido && (
        <Alerta tom="ok" titulo={'Lido: ' + vm.lido.titulos + ' título(s) em ' + vm.lido.grupos + ' grupo(s)'}>
          <p className="alert-text">
            Origem: {vm.lido.origem} · {vm.lido.dias} dia(s) de liquidação · valor somado <span className="num">{cr.brl(vm.lido.valor)}</span>
            {vm.lido.ignorados > 0 && <> · {vm.lido.ignorados} baixa(s) por pedido do cedente ficaram de fora</>}
          </p>
          {vm.lido.avisos.map((a, i) => <p key={i} className="alert-text">{a}</p>)}
        </Alerta>
      )}

      <div className="btn-row">
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar para a conferência</button>
      </div>
    </section>
  );
}
