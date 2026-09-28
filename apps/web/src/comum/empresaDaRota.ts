// A empresa aberta num aplicativo que usa só a lista do escritório (sem banco próprio):
// o pedaço :empresa da URL é o código do ERP, ou o nome (slug) quando não tem código.
import { empresas } from '@nads/core';

export function empresaDaRota(param: string): empresas.EmpresaDoEscritorio | null {
  return empresas.empresaPelaRota(empresas.EMPRESAS, param);
}
