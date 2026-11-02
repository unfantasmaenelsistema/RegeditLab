export type RegistryValueType =
  | 'REG_SZ'
  | 'REG_EXPAND_SZ'
  | 'REG_MULTI_SZ'
  | 'REG_DWORD'
  | 'REG_QWORD'
  | 'REG_BINARY';

export interface ValueGuideOption {
  value: string;
  label: string;
  impact: 'nominal' | 'warning' | 'danger';
}

export interface RegistryValue {
  id: string;
  name: string;
  type: RegistryValueType;
  data: string;
  description?: string;
  allowedGuide?: ValueGuideOption[];
  isDefault?: boolean;
  isSystemCritical?: boolean;
}

export type HiveShortName = 'ROOT' | 'HKCR' | 'HKCU' | 'HKLM' | 'HKU' | 'HKCC';

export interface RegistryKeyNode {
  name: string;
  path: string;
  hive: HiveShortName;
  scopeLabel: string;
  description: string;
  values: RegistryValue[];
  children: RegistryKeyNode[];
  equivalentPath?: string;
  precedenceNote?: string;
}

export interface MissionScenario {
  id: string;
  number: string;
  title: string;
  category:
    | 'Arranque y Energía'
    | 'Seguridad y Malware'
    | 'Hardware y Periféricos'
    | 'Almacenamiento y Rutas'
    | 'Directivas de Usuario';
  difficulty: 'Básico' | 'Intermedio' | 'Avanzado';
  hiveFocus: 'HKLM' | 'HKCU' | 'HKLM vs HKCU' | 'HKLM + HKU';
  symptom: string;
  didacticExplanation: string;
  targetPath: string;
  targetValueName: string;
  hint: string;
  expectedSummary: string;
  checkCompleted: (root: RegistryKeyNode) => boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: 'MODIFICAR' | 'CREAR_VALOR' | 'ELIMINAR_VALOR' | 'CREAR_CLAVE' | 'ELIMINAR_CLAVE' | 'RESTAURAR' | 'IMPORTAR_REG';
  path: string;
  targetName: string;
  oldValue?: string;
  newValue?: string;
}
