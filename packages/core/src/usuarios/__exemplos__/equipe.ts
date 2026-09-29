// A equipe levantada em 22/09/2026 (documento "Sistema de Rotina Operacional"), para os dados de
// exemplo e as prévias. Não é o cadastro real: o real mora em usuarios/{uid} do Entregas.
import { docDaContaNova } from '../regras/conta';
import { lerUsuario } from '../regras/papeis';
import type { Departamento, Nivel, Usuario } from '../tipos';

const PESSOAS: readonly [string, Departamento, Nivel][] = [
  ['Nilma', 'fiscal', 'diretor'],
  ['Sávio', 'dp', 'diretor'],
  ['Vitor', 'contabil', 'senior'],
  ['Fernando', 'contabil', 'senior'],
  ['Felipe', 'contabil', 'pleno'],
  ['Clara', 'contabil', 'junior'],
  ['Heverton', 'fiscal', 'pleno'],
  ['Adivania', 'fiscal', 'pleno'],
];

const CRIACAO = new Date('2026-09-22T12:00:00.000Z');

export const EQUIPE_EXEMPLO: readonly Usuario[] = PESSOAS.map(([nome, departamento, nivel], i) =>
  lerUsuario('exemplo-' + (i + 1), docDaContaNova({ nome, senha: 'x', departamento, nivel }, CRIACAO)));
