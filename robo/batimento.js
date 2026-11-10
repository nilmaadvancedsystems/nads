// O batimento que só grava o que mudou (10/11/2026, consumo do banco). Os robôs batiam o ponto de minuto em minuto em vários
// documentos (robo/painelPC e painelVM, robosMaquinas, robo/arquivador, robo/sieg, robo/alterdata, robo/estado): ~20 mil
// gravações por dia, quase tudo o que o banco grava, e cada uma vira uma leitura em cada tela que ouve o documento. Agora o
// relógio de cada robô continua olhando de minuto em minuto, mas só grava:
//   - na hora (no máximo a cada 30 s), quando o conteúdo muda de verdade (sem contar a hora e os campos que mudam sozinhos);
//   - sem mudança, a cada 5 min, só para dizer "estou vivo".
// As telas dão o robô por atrasado depois de 7 min sem sinal (era 3) e por parado depois de 15 (era 10).
//
//   const b = criarBatimento({ ignorar: ['em', 'sinais'] });
//   if (b.vale(doc)) ref.set(doc).catch(() => b.falhou());
'use strict';

const SEM_MUDANCA_MS = 5 * 60 * 1000;
const FREIO_MS = 30 * 1000;

/** O conteúdo sem os campos ignorados (caminhos 'a' ou 'a.b'), em texto comparável. */
function assinatura(doc, ignorar) {
  try {
    const copia = JSON.parse(JSON.stringify(doc === undefined ? null : doc));
    for (const caminho of ignorar) {
      const partes = caminho.split('.');
      let alvo = copia;
      for (let i = 0; alvo && typeof alvo === 'object' && i < partes.length - 1; i++) alvo = alvo[partes[i]];
      if (alvo && typeof alvo === 'object') delete alvo[partes[partes.length - 1]];
    }
    return JSON.stringify(copia);
  } catch (e) { return String(Math.random()); }
}

/**
 * o: { ignorar: campos que não contam como mudança, 'a' ou 'a.b' (padrão ['em']), semMudancaMs, freioMs, agora() }.
 * vale(doc) diz se grava agora (e já conta como gravado); falhou() esquece a última gravação (a próxima volta grava).
 */
function criarBatimento(opcoes) {
  const o = Object.assign({ ignorar: ['em'], semMudancaMs: SEM_MUDANCA_MS, freioMs: FREIO_MS, agora: Date.now }, opcoes || {});
  const ignorar = new Set(o.ignorar);
  let ultima = null;
  let gravadoEm = -Infinity;
  return {
    vale(doc) {
      const a = assinatura(doc, ignorar);
      const t = o.agora();
      const passou = t - gravadoEm;
      const grava = a !== ultima ? passou >= o.freioMs : passou >= o.semMudancaMs;
      if (grava) { ultima = a; gravadoEm = t; }
      return grava;
    },
    falhou() { ultima = null; gravadoEm = -Infinity; },
  };
}

module.exports = { criarBatimento, assinatura, SEM_MUDANCA_MS, FREIO_MS };
