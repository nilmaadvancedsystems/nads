// Tabelas do resultado do Verificar por conta, com o limite de linhas.
// Origem: conferencia.html vcTabelaFaltando/vcTabela (~L3807-3822), vcAvisoTruncado (~L4119),
// alerta verde (vcInfoLidos ~L3713 / "Nenhuma pendência" ~L4165).
import { type conferencia as c, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import type { CSSProperties, ReactNode } from 'react';
import { VC_LIMITE_LINHAS } from '../useVerificarConta';

const { reais, nomeNorm } = formatos;

function AvisoTruncado({ total }: { total: number }) {
  return total > VC_LIMITE_LINHAS ? <p className="hint">Mostrando {VC_LIMITE_LINHAS} de {total}. Baixe o resultado (CSV) pra ver tudo.</p> : null;
}

function Exportado({ v }: { v?: string }) {
  const s = nomeNorm(v);
  return s === 'sim' ? <span className="vc-exp-sim">Sim</span> : s === 'nao' ? <span className="vc-exp-nao">Não</span> : <span className="vc-exp-sem">—</span>;
}

export function TabelaFaltando({ linhas }: { linhas: c.LinhaTabela[] }) {
  return (
    <>
      <div className="table-wrap">
        <table className="vc-tabela">
          <thead><tr><th>Data</th><th>Nota</th><th>Participante</th><th>CFOP</th><th>Exportado</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {linhas.slice(0, VC_LIMITE_LINHAS).map((l, i) => (
              <tr key={i} className="bad">
                <td className="vc-nw">{l.data}</td><td className="vc-nw">{l.nota || '—'}</td>
                <td className="vc-nome">{l.part || '—'}</td><td className="vc-nw">{l.cfop || '—'}</td>
                <td className="vc-nw"><Exportado v={l.exportado} /></td><td className="num">{reais(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AvisoTruncado total={linhas.length} />
    </>
  );
}

/** cls: classe da linha ("bad" por padrão; ICMS vai sem). */
export function TabelaVc({ linhas, cls = 'bad' }: { linhas: c.LinhaTabela[]; cls?: string }) {
  return (
    <>
      <div className="table-wrap">
        <table className="vc-tabela">
          <thead><tr><th>Data</th><th>Nota</th><th>Participante</th><th>Contrapartida</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {linhas.slice(0, VC_LIMITE_LINHAS).map((l, i) => (
              <tr key={i} className={cls} title={l.txt || undefined}>
                <td className="vc-nw">{l.data}</td><td className="vc-nw">{l.nota || '—'}</td>
                <td className="vc-nome">{l.part || '—'}</td><td className="vc-nw">{l.contra || '—'}</td><td className="num">{reais(l.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AvisoTruncado total={linhas.length} />
    </>
  );
}

/** Uma seção das pendências: "Título — R$ x" e a tabela. */
export function SecaoVc({ titulo, valor, className = 'vc-secao', children }: { titulo: string; valor: number; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <h4>{titulo} — <span style={{ color: 'var(--ink-muted)', fontWeight: 600 }}>{reais(valor)}</span></h4>
      {children}
    </div>
  );
}

const ESTILO_OK: CSSProperties = { borderColor: 'var(--success)', background: 'var(--success-soft)', color: 'var(--success-ink)' };

/** Aviso verde (.alert com as cores de sucesso), com margem opcional como no original. */
export function AlertaVerde({ titulo, children, margem }: { titulo: string; children?: ReactNode; margem?: string }) {
  return (
    <div className="alert" style={margem ? { ...ESTILO_OK, margin: margem } : ESTILO_OK}>
      <Icone nome="checkCircle" />
      <div>
        <p className="alert-title">{titulo}</p>
        {children}
      </div>
    </div>
  );
}
