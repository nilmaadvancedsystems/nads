// As pastas de dados do robô NESTE PC, fora do AppData (26/10/2026).
//
// O que era: o controle do arquivador novo (config.json, o manifesto, os índices, a quarentena) e o perfil do Chrome do SIEG
// ficavam em %LOCALAPPDATA%. O Claude para Windows é um app empacotado (MSIX): tudo o que é gravado no AppData por um
// processo aberto por ele vai para uma cópia particular (…\Packages\Claude_…\LocalCache\Local\…), e um processo aberto por
// fora (o Agendador, o vigia) não vê essa cópia. Em 23/10 às 21:36 o vigia religou o robô por fora: ele leu um AppData sem
// o config.json (ficou em SIMULAÇÃO) e sem o manifesto do arquivador novo (o índice de conteúdo caiu de 37.446 para
// 13.574). Fora do AppData (no perfil do usuário) não há cópia particular: todos veem os mesmos arquivos.
//
// NADS_LOCAL muda a base (os testes); o padrão é %USERPROFILE%\nads.
'use strict';
const os = require('os');
const path = require('path');

const BASE = process.env.NADS_LOCAL || path.join(os.homedir(), 'nads');
module.exports = {
  BASE,
  /** o controle do arquivador novo (config.json, MANIFESTO, continuo, QUARENTENA, índices) */
  CONTROLE: path.join(BASE, 'arquivador-novo'),
  /** os dados do robô (o perfil do Chrome do SIEG, o cache dos XMLs do Drive) */
  ROBO: path.join(BASE, 'robo'),
  /** onde ficava antes (para a migração) */
  ANTIGO_CONTROLE: path.join(process.env.LOCALAPPDATA || os.homedir(), 'nads', 'arquivador-novo'),
  ANTIGO_ROBO: path.join(process.env.LOCALAPPDATA || os.homedir(), 'nads-robo'),
};
