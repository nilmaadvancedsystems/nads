// Uma caixa de importação (.import-box): título com ícone, "Escolher arquivos" (vários), a lista do
// que foi escolhido e o botão Importar (e, no protótipo, "Importar dados de teste").
import { BotaoAcao, CampoArquivos, Icone } from '@nads/ui';
import type { ConfigCaixa } from '../useImportacao';

export function CaixaImportacao({ caixa, ocupado, onEscolher, onTirar, onImportar, onTeste }: {
  caixa: ConfigCaixa & { escolhidos: File[]; lendo: boolean };
  ocupado: boolean;
  onEscolher: (fs: File[]) => void;
  onTirar: (i: number) => void;
  onImportar: () => void;
  /** PROTÓTIPO: importar dados de teste */
  onTeste?: () => void;
}) {
  const n = caixa.escolhidos.length;
  return (
    <div className="import-box">
      <div className="import-box-head">
        <span className="import-card-ico"><Icone nome={caixa.icone} /></span>
        <div className="import-box-titulo"><h3>{caixa.titulo}</h3><p className="import-card-hint">{caixa.formato}</p></div>
      </div>
      <div className="import-box-row">
        <CampoArquivos id={caixa.idArquivo} aceitar={caixa.aceitar} onEscolher={onEscolher} rotulo={n ? 'Escolher mais arquivos' : 'Escolher arquivos'} />
        <BotaoAcao carregando={caixa.lendo} textoCarregando="Importando…" disabled={!n || ocupado} onClick={onImportar}>Importar</BotaoAcao>
      </div>
      {n > 0 && (
        <div className="arquivo-lista">
          {caixa.escolhidos.map((f, i) => (
            <div key={f.name + i} className="arquivo-item">
              <Icone nome="fileText" />
              <div className="arquivo-txt"><span className="arquivo-nome">{f.name}</span><span className="hint">{(f.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB</span></div>
              <button type="button" className="file-clear ext-tirar" title="Tirar arquivo" aria-label={'Tirar ' + f.name} disabled={caixa.lendo} onClick={() => onTirar(i)}>×</button>
            </div>
          ))}
        </div>
      )}
      <p className="hint">{caixa.dica}</p>
      {onTeste && (
        <div>
          <button type="button" className="btn btn-sm btn-outline" disabled={ocupado} onClick={onTeste} title="Protótipo: importa lançamentos inventados, com TESTE no nome do arquivo">
            <Icone nome="zap" />Importar dados de teste
          </button>
        </div>
      )}
    </div>
  );
}
