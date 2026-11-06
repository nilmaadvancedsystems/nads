// Os arquivos já importados (só o nome e os lançamentos lidos: o arquivo não é guardado).
import { formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import type { useImportacao } from '../useImportacao';

type Arquivo = ReturnType<typeof useImportacao>['arquivos'][number];

export function ArquivosImportados({ arquivos, onExcluir }: { arquivos: Arquivo[]; onExcluir: (id: string) => void }) {
  return (
    <div className="gh-box">
      <div className="gh-box-head">
        <div className="gh-box-counts"><span><b>Arquivos importados</b><span className="gh-counter">{arquivos.length}</span></span></div>
      </div>
      {!arquivos.length ? (
        <div className="gh-blank">
          <Icone nome="upload" />
          <h4>Nenhum arquivo importado</h4>
          <p>Comece pelos extratos do banco e depois importe o razão da conta.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Origem</th><th>Arquivo</th><th>Período</th><th className="num">Lançamentos</th><th>Importado em</th><th /></tr></thead>
            <tbody>
              {arquivos.map(a => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><span className="ext-origem"><Icone nome={a.lado === 'banco' ? 'landmark' : 'list'} />{a.lado === 'banco' ? 'Extrato' : 'Sistema'}</span></td>
                  <td className="wrap">{a.nome}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{a.periodo}</td>
                  <td className="num">{a.qtd}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatos.dataHora(a.quando)}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-danger" type="button" onClick={() => onExcluir(a.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
