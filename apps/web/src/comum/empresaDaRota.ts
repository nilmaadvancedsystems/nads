// A empresa aberta num aplicativo que usa só a lista do escritório (sem banco próprio):
// o pedaço :empresa da URL é o código do ERP, ou o nome (slug) quando não tem código.
import { demo, empresas } from '@nads/core';

// a lista do escritório com a empresa de teste (Personaly Company)
const LISTA = demo.comEmpresaDemo(empresas.EMPRESAS, demo.EMPRESA_DEMO);

// as empresas cadastradas pelo nads (Cadastro › Nova empresa): quem tem o cadastro (a Tarefas) diz quais são
let extras: () => readonly empresas.EmpresaDoEscritorio[] = () => [];
export function definirEmpresasExtras(f: () => readonly empresas.EmpresaDoEscritorio[]): void { extras = f; }

export function empresaDaRota(param: string): empresas.EmpresaDoEscritorio | null {
  return empresas.empresaPelaRota(LISTA, param) || empresas.empresaPelaRota(extras(), param);
}
