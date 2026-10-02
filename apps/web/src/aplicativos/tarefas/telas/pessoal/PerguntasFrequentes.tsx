// View das Perguntas frequentes (a Minha página › Perguntas frequentes): o FAQ da Tarefas (ajuda/faq-tarefas.md, o
// mesmo que a IA consulta), por seção ou pela busca; cada resposta tem o "Perguntar à IA" para ir além.
import { Icone } from '@nads/ui';
import { useState } from 'react';
import { buscarNoFaq, FAQ, type PerguntaFrequente } from '../../ajuda/faq';
import { TextoIA } from './ChatIA';

export function PerguntasFrequentes({ perguntarIA }: { perguntarIA: (texto: string) => void }) {
  const [busca, setBusca] = useState('');
  const achadas = busca.trim() ? buscarNoFaq(busca) : FAQ;
  const secoes: { secao: string; itens: PerguntaFrequente[] }[] = [];
  if (busca.trim()) secoes.push({ secao: '', itens: [...achadas] });
  else for (const f of achadas) {
    const s = secoes[secoes.length - 1];
    if (s && s.secao === f.secao) s.itens.push(f); else secoes.push({ secao: f.secao, itens: [f] });
  }
  return (
    <>
      <label className="busca-curta faq-busca">
        <Icone nome="search" />
        <input type="text" placeholder="Buscar nas perguntas (ex.: cobrança, senha, drive)" aria-label="Buscar nas perguntas frequentes" value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
      {!achadas.length ? (
        <div className="card gh-blank">
          <Icone nome="ajuda" />
          <h4>Nenhuma pergunta com "{busca}"</h4>
          <p>A IA do escritório pode saber.</p>
          <button type="button" className="btn btn-primary" onClick={() => perguntarIA(busca.trim())}><Icone nome="robo" />Perguntar à IA</button>
        </div>
      ) : secoes.map(s => (
        <section key={s.secao || 'busca'} className="faq-secao">
          {s.secao && <h3>{s.secao}</h3>}
          <div className="card faq-lista">
            {s.itens.map(f => (
              <details key={f.id} className="faq-item">
                <summary>{f.pergunta}</summary>
                <div className="faq-resposta">
                  <TextoIA texto={f.resposta} />
                  <button type="button" className="link-btn" onClick={() => perguntarIA('Sobre "' + f.pergunta + '": ')}><Icone nome="robo" />Não resolveu? Perguntar à IA</button>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      {achadas.length > 0 && (
        <p className="fraco faq-pe">Não achou? <button type="button" className="link-btn" onClick={() => perguntarIA(busca.trim())}>Pergunte à IA do escritório</button>.</p>
      )}
    </>
  );
}
