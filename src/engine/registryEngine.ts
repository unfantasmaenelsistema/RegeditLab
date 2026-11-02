import { RegistryKeyNode, RegistryValue, RegistryValueType } from '../types/registry';

// Motor puro del simulador: validación de datos, formato como regedit.exe,
// barra de direcciones y serialización .reg. Sin React para poder probarlo.

export const DWORD_MAX = 0xffffffffn;
export const QWORD_MAX = (1n << 64n) - 1n;

export type ParseResult = { ok: true; value: string } | { ok: false; error: string };

export function isNumericType(type: RegistryValueType): boolean {
  return type === 'REG_DWORD' || type === 'REG_QWORD';
}

function maxFor(type: RegistryValueType): bigint {
  return type === 'REG_QWORD' ? QWORD_MAX : DWORD_MAX;
}

/** Valor numérico guardado (decimal) → BigInt. Datos corruptos cuentan como 0. */
export function toBigInt(data: string): bigint {
  return /^\d+$/.test(data.trim()) ? BigInt(data.trim()) : 0n;
}

/**
 * Convierte lo que el alumno escribe en el cuadro «Información del valor» en el
 * decimal que se guarda. Igual que regedit: vacío equivale a 0, en hexadecimal se
 * admite el prefijo 0x y no se aceptan valores fuera del rango del tipo.
 */
export function parseNumericInput(
  text: string,
  base: 'hex' | 'dec',
  type: RegistryValueType
): ParseResult {
  let t = text.trim();
  if (t === '') return { ok: true, value: '0' };
  if (base === 'hex') {
    t = t.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(t)) {
      return { ok: false, error: 'En hexadecimal solo se admiten los dígitos 0-9 y A-F.' };
    }
  } else if (!/^\d+$/.test(t)) {
    return { ok: false, error: 'En decimal solo se admiten dígitos 0-9 (sin signo ni separadores).' };
  }
  const n = base === 'hex' ? BigInt(`0x${t}`) : BigInt(t);
  if (n > maxFor(type)) {
    const bits = type === 'REG_QWORD' ? 64 : 32;
    return {
      ok: false,
      error: `Fuera de rango: un ${type} es un entero sin signo de ${bits} bits (máximo ${maxFor(type).toString()} = 0x${maxFor(type).toString(16)}).`,
    };
  }
  return { ok: true, value: n.toString() };
}

/** Decimal guardado → texto en la base elegida (lo que muestra el cuadro de edición). */
export function numericToBase(data: string, base: 'hex' | 'dec'): string {
  const n = toBigInt(data);
  return base === 'hex' ? n.toString(16) : n.toString();
}

/**
 * Bytes de un REG_BINARY. Acepta «00 01 a4», «00,01,a4» o «0001a4» y lo deja
 * como lo muestra regedit: pares hexadecimales en minúscula separados por espacio.
 */
export function normalizeBinaryInput(text: string): ParseResult {
  const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
  const compact = tokens.join('');
  if (compact === '') return { ok: true, value: '' };
  if (!/^[0-9a-f]+$/i.test(compact)) {
    return { ok: false, error: 'Un valor binario solo admite bytes en hexadecimal (00-ff).' };
  }
  // Con separadores cada byte va completo: «0 1» es ambiguo (¿01 o 00 01?)
  const badToken = tokens.length > 1 && tokens.some((t) => t.length % 2 !== 0);
  if (badToken || compact.length % 2 !== 0) {
    return { ok: false, error: 'Cada byte son dos dígitos hexadecimales: falta un dígito.' };
  }
  return { ok: true, value: compact.toLowerCase().match(/../g)!.join(' ') };
}

/** Valida y normaliza el dato de un valor nuevo o editado según su tipo. */
export function normalizeValueData(
  type: RegistryValueType,
  text: string,
  base: 'hex' | 'dec' = 'dec'
): ParseResult {
  if (isNumericType(type)) return parseNumericInput(text, base, type);
  if (type === 'REG_BINARY') return normalizeBinaryInput(text);
  if (type === 'REG_MULTI_SZ') {
    // regedit descarta las líneas vacías de una cadena múltiple
    return { ok: true, value: text.split(/\r?\n/).filter((l) => l !== '').join('\n') };
  }
  return { ok: true, value: text };
}

export function formatRegistryDataForDisplay(val: RegistryValue): string {
  if (isNumericType(val.type)) {
    const n = toBigInt(val.data);
    return `0x${n.toString(16).padStart(8, '0')} (${n.toString()})`;
  }
  if (val.type === 'REG_BINARY') {
    return val.data === '' ? '(valor binario de longitud cero)' : val.data;
  }
  if (val.type === 'REG_MULTI_SZ') {
    return val.data.replace(/\n/g, ' ');
  }
  if (val.isDefault && val.data === '') return '(valor no establecido)';
  return val.data;
}

const HIVE_ALIASES: Record<string, string> = {
  HKLM: 'HKEY_LOCAL_MACHINE',
  HKEY_LOCAL_MACHINE: 'HKEY_LOCAL_MACHINE',
  HKCU: 'HKEY_CURRENT_USER',
  HKEY_CURRENT_USER: 'HKEY_CURRENT_USER',
  HKCR: 'HKEY_CLASSES_ROOT',
  HKEY_CLASSES_ROOT: 'HKEY_CLASSES_ROOT',
  HKU: 'HKEY_USERS',
  HKEY_USERS: 'HKEY_USERS',
  HKCC: 'HKEY_CURRENT_CONFIG',
  HKEY_CURRENT_CONFIG: 'HKEY_CURRENT_CONFIG',
};

/**
 * Normaliza lo escrito en la barra de direcciones como hace regedit: admite el
 * prefijo «Equipo\» o «Computer\», las abreviaturas HKLM/HKCU/HKCR/HKU/HKCC,
 * comillas y barras sobrantes. Devuelve null si no empieza por una rama válida.
 */
export function resolveRegistryAddress(input: string): string | null {
  let t = input.trim().replace(/^"(.*)"$/, '$1').replace(/\//g, '\\');
  t = t.replace(/\\+/g, '\\').replace(/^\\|\\$/g, '');
  if (t === '') return null;
  const parts = t.split('\\');
  if (/^(equipo|computer|pc)$/i.test(parts[0])) parts.shift();
  if (parts.length === 0) return 'Equipo';
  const hive = HIVE_ALIASES[parts[0].toUpperCase()];
  if (!hive) return null;
  parts[0] = hive;
  return ['Equipo', ...parts].join('\\');
}

function escapeRegString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function utf16leBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out.push(c & 0xff, c >> 8);
  }
  return out;
}

/** Bytes en formato .reg con el ajuste de línea de regedit (máx. 80 columnas, «\» y dos espacios). */
function hexLine(prefix: string, bytes: number[]): string[] {
  const lines: string[] = [];
  let line = prefix;
  bytes.forEach((b, i) => {
    const piece = b.toString(16).padStart(2, '0') + (i < bytes.length - 1 ? ',' : '');
    if (line.length + piece.length > 79 && line.trim() !== '') {
      lines.push(`${line}\\`);
      line = '  ';
    }
    line += piece;
  });
  lines.push(line);
  return lines;
}

export function serializeValue(val: RegistryValue): string[] {
  const name = val.isDefault ? '@' : `"${escapeRegString(val.name)}"`;
  switch (val.type) {
    case 'REG_SZ':
      return [`${name}="${escapeRegString(val.data)}"`];
    case 'REG_DWORD':
      return [`${name}=dword:${toBigInt(val.data).toString(16).padStart(8, '0')}`];
    case 'REG_QWORD': {
      let n = toBigInt(val.data);
      const bytes: number[] = [];
      for (let i = 0; i < 8; i++) {
        bytes.push(Number(n & 0xffn));
        n >>= 8n;
      }
      return hexLine(`${name}=hex(b):`, bytes);
    }
    case 'REG_EXPAND_SZ':
      return hexLine(`${name}=hex(2):`, [...utf16leBytes(val.data), 0, 0]);
    case 'REG_MULTI_SZ': {
      const strings = val.data.split('\n').filter((s) => s !== '');
      const bytes = strings.flatMap((s) => [...utf16leBytes(s), 0, 0]);
      return hexLine(`${name}=hex(7):`, [...bytes, 0, 0]);
    }
    case 'REG_BINARY': {
      const bytes = val.data === '' ? [] : val.data.split(' ').map((h) => parseInt(h, 16));
      return hexLine(`${name}=hex:`, bytes);
    }
  }
}

export const REG_EXPORT_WARNING = [
  '; ------------------------------------------------------------------',
  '; Exportado desde RegEdit Lab (simulador de Un Fantasma en el Sistema).',
  '; Los datos son FICTICIOS: no importes este archivo en un Windows real.',
  '; ------------------------------------------------------------------',
];

/** Serializa una rama con la sintaxis de «Archivo → Exportar» de regedit.exe. */
export function generateRegFileContent(node: RegistryKeyNode): string {
  const lines: string[] = ['Windows Registry Editor Version 5.00', '', ...REG_EXPORT_WARNING, ''];

  function walk(current: RegistryKeyNode) {
    if (current.path !== 'Equipo') {
      lines.push(`[${current.path.replace(/^Equipo\\/, '')}]`);
      for (const val of current.values) {
        // regedit omite el valor predeterminado si no tiene datos
        if (val.isDefault && val.data === '') continue;
        lines.push(...serializeValue(val));
      }
      lines.push('');
    }
    current.children.forEach(walk);
  }

  walk(node);
  return lines.join('\r\n');
}

export function hasValueNamed(node: RegistryKeyNode, name: string, exceptId?: string): boolean {
  return node.values.some(
    (v) => v.id !== exceptId && v.name.toLowerCase() === name.trim().toLowerCase()
  );
}

/** Comprueba la forma de un árbol leído de localStorage antes de usarlo. */
export function isRegistryTree(x: unknown): x is RegistryKeyNode {
  if (!x || typeof x !== 'object') return false;
  const n = x as Record<string, unknown>;
  if (typeof n.name !== 'string' || typeof n.path !== 'string' || typeof n.hive !== 'string') {
    return false;
  }
  if (!Array.isArray(n.values) || !Array.isArray(n.children)) return false;
  const valuesOk = n.values.every(
    (v) =>
      v &&
      typeof v === 'object' &&
      typeof (v as RegistryValue).id === 'string' &&
      typeof (v as RegistryValue).name === 'string' &&
      typeof (v as RegistryValue).type === 'string' &&
      typeof (v as RegistryValue).data === 'string'
  );
  return valuesOk && n.children.every(isRegistryTree);
}

let idCounter = 0;
/** Identificador único aunque se creen varios elementos en el mismo milisegundo. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
