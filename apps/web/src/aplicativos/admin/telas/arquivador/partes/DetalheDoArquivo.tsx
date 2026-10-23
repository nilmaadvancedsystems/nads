// O detalhe de um arquivo no Arquivador (Vitor, 22/10/2026: "só que eu preciso de um feedback melhor dele"): o que o robô
// fez e por quê — o ícone e o nome, o selo da decisão e quando; o que fazer (no não identificado e no erro); os dados (o
// cliente, o tipo, a confiança, o destino, o nome final, de onde veio, a leitura por OCR); as evidências que as regras
// devolveram, em português; as cópias e a pasta nova. Peça do catálogo (Listas), junto com a lista ao lado. No Para
// resolver (23/10/2026), as ações embaixo do título (Abrir o arquivo, Arquivar em…, Descartar) e o formulário no fim.
import { Icone, IconeDeArquivo, type FormatoDoArquivo } from '@nads/ui';
import type { ReactNode } from 'react';
import type { TomDaLinha } from './ListaComDetalhe';

export interface DadosDoDetalhe {
  nome: string; formato: FormatoDoArquivo; selo: { rotulo: string; tom: TomDaLinha }; quando?: string;
  dados: { rotulo: string; valor: string }[];
  acao?: { titulo: string; texto: string; tom: TomDaLinha } | null;
  evidencias?: string[]; copias?: string[]; pastaNova?: string; erroTecnico?: string;
}
const SELO: Record<TomDaLinha, string> = { ok: 'badge-ok', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };

export function DetalheDoArquivo({ d, acoes, formulario }: { d: DadosDoDetalhe; acoes?: ReactNode; formulario?: ReactNode }) {
  return (
    <div className="arq-detalhe">
      <div className="arq-detalhe-topo">
        <IconeDeArquivo formato={d.formato} tamanho={40} />
        <div className="arq-detalhe-titulo">
          <h3>{d.nome}</h3>
          <span className="arq-detalhe-selo">
            <span className={'badge badge-suave ' + SELO[d.selo.tom]}>{d.selo.rotulo}</span>
            {d.quando && <span className="fraco num">{d.quando}</span>}
          </span>
        </div>
      </div>

      {acoes && <div className="arq-detalhe-acoes">{acoes}</div>}
      {formulario}

      {d.acao && (
        <div className={'arq-fazer ' + d.acao.tom}>
          <span className="arq-fazer-icone" aria-hidden="true"><Icone nome={d.acao.tom === 'erro' ? 'x' : 'lampada'} width={16} height={16} /></span>
          <div><b>{d.acao.titulo}</b>{d.acao.texto && <p>{d.acao.texto}</p>}</div>
        </div>
      )}

      {d.dados.length > 0 && (
        <dl className="ent-dados arq-detalhe-dados">
          {d.dados.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.valor}</dd></div>)}
        </dl>
      )}

      {!!d.evidencias?.length && (
        <div className="arq-detalhe-bloco">
          <h4>Por quê</h4>
          <ul className="arq-evidencias">
            {d.evidencias.map((e, i) => <li key={i}><Icone nome="check" width={14} height={14} /><span>{e}</span></li>)}
          </ul>
        </div>
      )}

      {!!d.copias?.length && (
        <div className="arq-detalhe-bloco">
          <h4>{d.copias.length === 1 ? 'Cópia' : 'Cópias'}</h4>
          <ul className="arq-evidencias">{d.copias.map(c => <li key={c}><Icone nome="copiar" width={14} height={14} /><span>{c}</span></li>)}</ul>
        </div>
      )}

      {d.pastaNova && (
        <div className="arq-detalhe-bloco">
          <h4>Pasta nova</h4>
          <ul className="arq-evidencias"><li><Icone nome="pasta" width={14} height={14} /><span>Criou a pasta do cliente <b>{d.pastaNova}</b> (o CNPJ do documento confere com o cadastro)</span></li></ul>
        </div>
      )}

      {d.erroTecnico && (
        <div className="arq-detalhe-bloco">
          <h4>O erro, como veio</h4>
          <p className="arq-erro-tecnico">{d.erroTecnico}</p>
        </div>
      )}
    </div>
  );
}
