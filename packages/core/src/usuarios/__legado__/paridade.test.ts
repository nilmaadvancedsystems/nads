/// <reference types="node" />
// Paridade com o Entregas: as funções de login e de papéis recortadas do entregas.html original
// (só lidas, nunca executado o arquivo inteiro) têm de dar o mesmo resultado que as daqui. Assim a
// mesma pessoa entra com o mesmo nome nos dois sistemas e vê os mesmos cargos.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extrairFuncao, extrairVar } from '../../conferencia/__legado__/carregar';
import { emailDoLogin, emailDoNome, lerUsuario, papeisDoDoc, rotuloDoCargo } from '..';

const CAMINHO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../Entregas/entregas.html');
const d = existsSync(CAMINHO) ? describe : describe.skip;

interface Entregas {
  emailFromNome(n: string): string;
  resolveLoginEmail(n: string): string;
  papeisDoDoc_(doc: object): string[];
  cargosLabel_(roles: string[]): string;
}

function carregar(): Entregas {
  const src = readFileSync(CAMINHO, 'utf8');
  const corpo = [
    '"use strict";',
    extrairVar(src, 'DIACRITICS_RE'),
    extrairVar(src, 'CARGOS'),
    ...['emailFromNome', 'resolveLoginEmail', 'papeisDoDoc_', 'cargosLabel_'].map(f => extrairFuncao(src, f)),
    'return { emailFromNome: emailFromNome, resolveLoginEmail: resolveLoginEmail, papeisDoDoc_: papeisDoDoc_, cargosLabel_: cargosLabel_ };',
  ].join('\n');
  return new Function(corpo)() as Entregas;
}

d('paridade com o Entregas (entregas.html)', () => {
  const E = existsSync(CAMINHO) ? carregar() : (null as unknown as Entregas);

  it('nome → e-mail de login', () => {
    for (const n of ['Vitor', 'José da Silva', '  Sávio  ', 'Ana-Maria O\'Neil', 'CLARA', 'Adivânia', 'wesley 2', '...x...', 'Ção']) {
      expect(emailDoNome(n)).toBe(E.emailFromNome(n));
      expect(emailDoLogin(n)).toBe(E.resolveLoginEmail(n));
    }
    expect(emailDoLogin(' sistemasnilma@gmail.com ')).toBe(E.resolveLoginEmail(' sistemasnilma@gmail.com '));
  });

  it('papéis lidos do documento', () => {
    for (const doc of [{ roles: ['admin', 'contabil'] }, { roles: [] }, { role: 'fiscal' }, {}, { roles: ['office_boy'], role: 'admin' }]) {
      expect(papeisDoDoc(doc)).toEqual(E.papeisDoDoc_(doc));
    }
  });

  it('rótulo dos cargos de quem ainda não tem departamento/nível', () => {
    for (const roles of [['staff'], ['admin'], ['contabil', 'admin'], ['office_boy', 'equipe_geral'], ['fiscal']]) {
      const u = lerUsuario('x', { roles });
      expect(rotuloDoCargo(u)).toBe(E.cargosLabel_(roles));
    }
  });
});
