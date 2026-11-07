// Os filtros de Para resolver em grupos (lote, 07/11/2026: ~1.340 arquivos parados em dezenas de grupos): a busca pela pasta,
// pela causa ou pelo nome de um exemplo, a causa e o tipo provável (o do mapa da migração), cada opção com quantos arquivos
// tem; embaixo, a frase com quantos grupos e arquivos passam. Só junta peças que já existem (a busca curta, os selects
// compactos, o botão Limpar da barra de filtros do Arquivador). Peça do catálogo (Campos).
import { Icone } from '@nads/ui';

export interface OpcaoDoFiltroDosGrupos { valor: string; rotulo: string; arquivos: number }
export interface DadosDosFiltrosDosGrupos {
  busca: string; setBusca: (t: string) => void;
  motivo: string; setMotivo: (v: string) => void; opcoesMotivo: OpcaoDoFiltroDosGrupos[];
  tipo: string; setTipo: (v: string) => void; opcoesTipo: OpcaoDoFiltroDosGrupos[];
  ativo: boolean; limpar: () => void;
  /** o que passa nos filtros e o total geral */
  mostrando: { grupos: number; arquivos: number }; total: { grupos: number; arquivos: number };
}

const n = (v: number) => v.toLocaleString('pt-BR');

export function FiltrosDosGrupos({ f }: { f: DadosDosFiltrosDosGrupos }) {
  return (
    <div className="arq-grupos-filtros">
      <div className="arq-filtros">
        <label className="busca-curta larga"><Icone nome="search" width={16} height={16} /><input type="text" placeholder="Buscar pela pasta, causa ou nome" aria-label="Buscar nos grupos" value={f.busca} onChange={e => f.setBusca(e.target.value)} /></label>
        <select className="select-compact" aria-label="Causa" value={f.motivo} onChange={e => f.setMotivo(e.target.value)}>
          <option value="">Todas as causas</option>
          {f.opcoesMotivo.map(o => <option key={o.valor} value={o.valor}>{o.rotulo + ' · ' + n(o.arquivos)}</option>)}
        </select>
        <select className="select-compact" aria-label="Tipo provável" value={f.tipo} onChange={e => f.setTipo(e.target.value)}>
          <option value="">Todos os tipos prováveis</option>
          {f.opcoesTipo.map(o => <option key={o.valor} value={o.valor}>{o.rotulo + ' · ' + n(o.arquivos)}</option>)}
        </select>
        {f.ativo && <button type="button" className="btn btn-ghost" onClick={f.limpar}>Limpar</button>}
      </div>
      <p className="hint num">
        {f.ativo
          ? n(f.mostrando.grupos) + ' de ' + n(f.total.grupos) + ' grupos · ' + n(f.mostrando.arquivos) + ' de ' + n(f.total.arquivos) + ' arquivos'
          : n(f.total.grupos) + (f.total.grupos === 1 ? ' grupo · ' : ' grupos · ') + n(f.total.arquivos) + (f.total.arquivos === 1 ? ' arquivo' : ' arquivos')}
      </p>
    </div>
  );
}
