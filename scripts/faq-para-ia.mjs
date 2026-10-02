#!/usr/bin/env node
// Leva as Perguntas frequentes da Tarefas (apps/web/src/aplicativos/tarefas/ajuda/faq-tarefas.md) para o guia que a IA
// do escritório consulta quando perguntam como usar o app: Entregas/scripts/guia-do-app.md (a ferramenta
// como_usar_o_app, scripts/ia-ajuda.js, lê o arquivo a cada pergunta: vale na hora no PC do escritório).
// O FAQ entra entre as marcas FAQ-TAREFAS (substitui o que estava), cada seção como "## Tarefas (nads) — <seção>".
//   npm run faq                      grava no ../Entregas/scripts/guia-do-app.md
//   npm run faq -- --guia=<caminho>  outro guia
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const faq = path.join(raiz, 'apps', 'web', 'src', 'aplicativos', 'tarefas', 'ajuda', 'faq-tarefas.md');
const arg = process.argv.find(a => a.startsWith('--guia='));
const guia = arg ? path.resolve(arg.slice('--guia='.length)) : path.resolve(raiz, '..', 'Entregas', 'scripts', 'guia-do-app.md');
if (!fs.existsSync(guia)) { console.error('faq: não achei o guia da IA em ' + guia + ' (use --guia=<caminho>)'); process.exit(1); }

const INICIO = '<!-- FAQ-TAREFAS:INICIO (gerado pelo nads: npm run faq; não edite aqui, edite o faq-tarefas.md) -->';
const FIM = '<!-- FAQ-TAREFAS:FIM -->';
const corpo = fs.readFileSync(faq, 'utf8').replace(/\r\n/g, '\n').trim()
  .replace(/^## (.+)$/gm, '## Tarefas (nads, tarefas-nilma.web.app) — $1');
const bloco = INICIO + '\n' + corpo + '\n' + FIM;
let texto = fs.readFileSync(guia, 'utf8');
const i = texto.indexOf('<!-- FAQ-TAREFAS:INICIO');
const f = texto.indexOf(FIM);
texto = i >= 0 && f > i ? texto.slice(0, i) + bloco + texto.slice(f + FIM.length) : texto.replace(/\s*$/, '') + '\n\n' + bloco + '\n';
fs.writeFileSync(guia, texto);
console.log('faq: ' + (corpo.match(/^### /gm) || []).length + ' perguntas no guia da IA (' + guia + ')');
