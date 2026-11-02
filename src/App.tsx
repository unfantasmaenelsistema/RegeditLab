import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  RotateCcw,
  FileDown,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Play,
  ArrowLeftRight,
  Copy,
  Check,
  HelpCircle,
  ExternalLink,
  HardDrive,
  User,
  Terminal,
  Bookmark,
  History,
  Eye,
} from 'lucide-react';
import {
  AuditLogEntry,
  RegistryKeyNode,
  RegistryValue,
  RegistryValueType,
} from './types/registry';
import {
  DIDACTIC_MISSIONS,
  INITIAL_REGISTRY_TREE,
  findNodeByPath,
  formatRegistryDataForDisplay,
  getValueData,
  isFastStartupActive,
  isMinerActive,
} from './data/initialRegistry';
import {
  hasValueNamed,
  isRegistryTree,
  newId,
  resolveRegistryAddress,
} from './engine/registryEngine';
import { CreateItemModal, ValueEditModal } from './components/ValueEditModal';
import { BootSimulatorModal, RegExportModal } from './components/SystemModals';
import {
  HklmVsHkcuComparator,
  RegistryTypesAndHivesGuide,
} from './components/DidacticReferenceViews';

// v2: el árbol cambió (Control\Power, datos corregidos); un estado v1 no se reutiliza
const STORAGE_KEY = 'ufes_regedit_simulator_tree_v2';
const MAX_AUDIT_LOGS = 500;

// Claves raíz donde regedit no deja crear subclaves (Nuevo → Clave aparece deshabilitado)
const NO_NEW_SUBKEY_PATHS = ['equipo', 'equipo\\hkey_local_machine', 'equipo\\hkey_users'];

function cloneTree(node: RegistryKeyNode): RegistryKeyNode {
  return JSON.parse(JSON.stringify(node));
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Almacenamiento bloqueado (modo privado, cookies desactivadas…)
  }
}

function getAllAncestorPaths(fullPath: string): string[] {
  const parts = fullPath.split('\\');
  const paths: string[] = [];
  let current = '';
  for (let i = 0; i < parts.length; i++) {
    current = i === 0 ? parts[0] : `${current}\\${parts[i]}`;
    paths.push(current);
  }
  return paths;
}

export default function App() {
  // Registry state with localStorage persistence
  const [registryRoot, setRegistryRoot] = useState<RegistryKeyNode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        // Un estado manipulado o a medias dejaría la app en blanco en cada recarga
        if (isRegistryTree(parsed) && parsed.path === 'Equipo') return parsed;
      }
    } catch {
      // Fallback to initial tree
    }
    return cloneTree(INITIAL_REGISTRY_TREE);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registryRoot));
    } catch {
      // Ignore storage errors
    }
  }, [registryRoot]);

  // Navigation & view tabs
  const [activeMainView, setActiveMainView] = useState<
    'simulator' | 'missions' | 'comparator' | 'guide'
  >('simulator');

  // Selected path & expanded nodes in Tree
  const [selectedPath, setSelectedPath] = useState<string>(
    'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power'
  );
  const [addressInput, setAddressInput] = useState<string>(selectedPath);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>(() => {
    const initialExpanded: Record<string, boolean> = {
      Equipo: true,
      'Equipo\\HKEY_LOCAL_MACHINE': true,
      'Equipo\\HKEY_CURRENT_USER': true,
    };
    for (const p of getAllAncestorPaths(
      'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power'
    )) {
      initialExpanded[p] = true;
    }
    for (const p of getAllAncestorPaths(
      'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
    )) {
      initialExpanded[p] = true;
    }
    return initialExpanded;
  });

  // Selected value inside the current key
  const [selectedValueId, setSelectedValueId] = useState<string | null>('hklm-pwr-hiberboot');

  // Modals state
  const [editingValue, setEditingValue] = useState<RegistryValue | null>(null);
  const [createModalMode, setCreateModalMode] = useState<'key' | 'value' | null>(null);
  const [createInitialType, setCreateInitialType] = useState<RegistryValueType>('REG_DWORD');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBootModal, setShowBootModal] = useState(false);

  // Dropdown menus inside regedit window
  const [openMenu, setOpenMenu] = useState<'file' | 'edit' | 'favorites' | null>(null);

  // Active Mission
  const [activeMissionId, setActiveMissionId] = useState<string>(DIDACTIC_MISSIONS[0].id);
  const [showHint, setShowHint] = useState<boolean>(false);

  // Search query & 3-second visual pulse highlight state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<boolean>(false);
  const [pulsingKeyPath, setPulsingKeyPath] = useState<string | null>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const treeNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Audit Log with localStorage persistence for student submissions
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const savedLogs = localStorage.getItem(`${STORAGE_KEY}_logs`);
      if (savedLogs) {
        const parsed: unknown = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (l): l is AuditLogEntry =>
              l && typeof l.id === 'string' && typeof l.action === 'string' && typeof l.path === 'string'
          );
        }
      }
    } catch {
      // Fallback
    }
    return [];
  });
  const [studentName, setStudentName] = useState<string>(() => {
    try {
      return localStorage.getItem(`${STORAGE_KEY}_student`) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_logs`, JSON.stringify(auditLogs));
    } catch {
      // Ignore storage errors
    }
  }, [auditLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_student`, studentName);
    } catch {
      // Ignore storage errors
    }
  }, [studentName]);

  // Logo resilient state
  const [logoError, setLogoError] = useState(false);

  const selectedNode = useMemo(
    () => findNodeByPath(registryRoot, selectedPath) || registryRoot,
    [registryRoot, selectedPath]
  );

  const selectedValue = useMemo(() => {
    if (!selectedValueId) return selectedNode.values[0] || null;
    return (
      selectedNode.values.find((v) => v.id === selectedValueId) ||
      selectedNode.values[0] ||
      null
    );
  }, [selectedNode, selectedValueId]);

  const activeMission = useMemo(
    () => DIDACTIC_MISSIONS.find((m) => m.id === activeMissionId) || DIDACTIC_MISSIONS[0],
    [activeMissionId]
  );

  const missionResults = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const m of DIDACTIC_MISSIONS) {
      map[m.id] = m.checkCompleted(registryRoot);
    }
    return map;
  }, [registryRoot]);

  const completedCount = useMemo(
    () => Object.values(missionResults).filter(Boolean).length,
    [missionResults]
  );

  // Navigate to a specific registry path, expand ancestors, scroll into view, and pulse for 3 seconds
  const navigateToPath = (
    targetPath: string,
    highlightValueName?: string,
    triggerPulse: boolean = true
  ) => {
    const node = findNodeByPath(registryRoot, targetPath);
    if (!node) return;
    setAddressError(null);
    const ancestors = getAllAncestorPaths(node.path);
    setExpandedPaths((prev) => {
      const next = { ...prev };
      for (const a of ancestors) {
        next[a] = true;
      }
      return next;
    });
    setSelectedPath(node.path);
    setAddressInput(node.path);
    if (highlightValueName) {
      const foundVal = node.values.find(
        (v) => v.name.toLowerCase() === highlightValueName.toLowerCase()
      );
      if (foundVal) {
        setSelectedValueId(foundVal.id);
      } else {
        setSelectedValueId(node.values[0]?.id || null);
      }
    } else {
      setSelectedValueId(node.values[0]?.id || null);
    }
    setActiveMainView('simulator');

    if (triggerPulse) {
      if (pulseTimerRef.current) {
        window.clearTimeout(pulseTimerRef.current);
      }
      setPulsingKeyPath(node.path);
      window.setTimeout(() => {
        treeNodeRefs.current[node.path]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 60);
      pulseTimerRef.current = window.setTimeout(() => {
        setPulsingKeyPath(null);
      }, 3000);
    }
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    function walk(n: RegistryKeyNode) {
      all[n.path] = true;
      n.children.forEach(walk);
    }
    walk(registryRoot);
    setExpandedPaths(all);
  };

  const collapseAll = () => {
    setExpandedPaths({ Equipo: true });
    setSelectedPath('Equipo');
    setAddressInput('Equipo');
  };

  const addAuditLog = (
    action: AuditLogEntry['action'],
    path: string,
    targetName: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setAuditLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        action,
        path,
        targetName,
        oldValue,
        newValue,
      },
      ...prev.slice(0, MAX_AUDIT_LOGS - 1),
    ]);
  };

  const handleDownloadLogTxt = () => {
    const dateStr = new Date().toLocaleString('es-ES');
    const cleanStudent = studentName.trim() || 'Alumno (Sin especificar)';
    const lines: string[] = [
      '========================================================================',
      'INFORME DE PRÁCTICA: SIMULADOR DEL EDITOR DEL REGISTRO DE WINDOWS (REGEDIT)',
      'Un Fantasma en el Sistema - https://www.unfantasmaenelsistema.com/',
      '========================================================================',
      `Alumno / Grupo : ${cleanStudent}`,
      `Fecha y hora   : ${dateStr}`,
      `Casos resueltos: ${completedCount} de ${DIDACTIC_MISSIONS.length}`,
      '------------------------------------------------------------------------',
      '1. ESTADO DE EVALUACIÓN DE LOS CASOS PRÁCTICOS:',
      '------------------------------------------------------------------------',
      ...DIDACTIC_MISSIONS.map(
        (m) =>
          `[${missionResults[m.id] ? 'RESUELTO' : 'PENDIENTE'}] Caso ${m.number}: ${m.title}\r\n    Clave objetivo: ${m.targetPath} (${m.expectedSummary})`
      ),
      '',
      '------------------------------------------------------------------------',
      `2. HISTORIAL CRONOLÓGICO DE OPERACIONES (${auditLogs.length} eventos):`,
      '------------------------------------------------------------------------',
    ];

    if (auditLogs.length === 0) {
      lines.push('(No se han registrado modificaciones en el Registro durante esta sesión)');
    } else {
      [...auditLogs].reverse().forEach((log, idx) => {
        const changeDetail =
          log.newValue !== undefined
            ? ` | Cambio: "${log.oldValue ?? '(vacío)'}" -> "${log.newValue}"`
            : log.oldValue !== undefined
            ? ` | Valor eliminado: "${log.oldValue}"`
            : '';
        lines.push(
          `${String(idx + 1).padStart(2, '0')}. [${log.timestamp}] ${log.action} | Clave: ${log.path} | Elemento: ${log.targetName}${changeDetail}`
        );
      });
    }

    lines.push('========================================================================');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (studentName.trim() || 'practica_regedit').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `informe_regedit_${safeName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadLogCsv = () => {
    const cleanStudent = studentName.trim() || 'Alumno';
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

    const rows: string[] = [
      ['Alumno', 'Hora', 'Tipo_Registro', 'Accion_o_Caso', 'Ruta_Clave', 'Elemento_Valor', 'Valor_Anterior', 'Valor_Nuevo_o_Estado']
        .map(escapeCsv)
        .join(';'),
    ];

    // Add mission evaluation summary rows first
    for (const m of DIDACTIC_MISSIONS) {
      rows.push(
        [
          cleanStudent,
          new Date().toLocaleTimeString('es-ES'),
          'EVALUACION_CASO',
          `Caso ${m.number}: ${m.title}`,
          m.targetPath,
          m.targetValueName,
          m.expectedSummary,
          missionResults[m.id] ? 'RESUELTO' : 'PENDIENTE',
        ]
          .map(escapeCsv)
          .join(';')
      );
    }

    // Add chronological audit log rows
    for (const log of [...auditLogs].reverse()) {
      rows.push(
        [
          cleanStudent,
          log.timestamp,
          'OPERACION_REGEDIT',
          log.action,
          log.path,
          log.targetName,
          log.oldValue ?? '',
          log.newValue ?? '',
        ]
          .map(escapeCsv)
          .join(';')
      );
    }

    // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens Spanish accents properly
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (studentName.trim() || 'practica_regedit').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `entrega_regedit_${safeName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Update a value inside the selected key
  const handleSaveValue = (valueId: string, newData: string, newName?: string): string | null => {
    const nextTree = cloneTree(registryRoot);
    const targetNode = findNodeByPath(nextTree, selectedPath);
    if (!targetNode) return null;
    const val = targetNode.values.find((v) => v.id === valueId);
    if (!val) return null;
    const renamed = Boolean(newName && !val.isDefault && newName !== val.name);
    if (renamed && hasValueNamed(targetNode, newName!, val.id)) {
      return `El Editor del Registro no puede cambiar el nombre de ${val.name}. El nombre de valor especificado ya existe. Escriba otro nombre e inténtelo de nuevo.`;
    }
    const oldName = val.name;
    const oldData = val.data;
    if (renamed) val.name = newName!;
    val.data = newData;
    if (!renamed && oldData === newData) return null;
    setRegistryRoot(nextTree);
    addAuditLog(
      'MODIFICAR',
      selectedPath,
      renamed ? `${oldName} → ${val.name}` : val.name,
      oldData,
      newData
    );
    return null;
  };

  // Create a new value in the selected key
  const handleCreateValue = (
    name: string,
    type: RegistryValueType,
    data: string,
    description: string
  ): string | null => {
    const nextTree = cloneTree(registryRoot);
    const targetNode = findNodeByPath(nextTree, selectedPath);
    if (!targetNode) return null;
    if (targetNode.path === 'Equipo') {
      return 'No se pueden crear valores en «Equipo»: selecciona antes una clave.';
    }
    if (hasValueNamed(targetNode, name)) {
      return `Ya existe un valor llamado «${name}» en esta clave. Escriba otro nombre e inténtelo de nuevo.`;
    }
    const id = newId('custom-val');
    targetNode.values.push({ id, name, type, data, description });
    setRegistryRoot(nextTree);
    setSelectedValueId(id);
    addAuditLog('CREAR_VALOR', selectedPath, name, undefined, data);
    return null;
  };

  // Delete a value (regedit pide confirmación antes de borrar)
  const handleDeleteValue = (val: RegistryValue) => {
    if (val.isDefault) return;
    const warning = val.isSystemCritical
      ? `«${val.name}» es un valor CRÍTICO del sistema. Si elimina ciertos valores del Registro, el sistema podría volverse inestable. ¿Está seguro de que desea eliminarlo permanentemente?`
      : `Si elimina ciertos valores del Registro, el sistema podría volverse inestable. ¿Está seguro de que desea eliminar permanentemente «${val.name}»?`;
    if (!window.confirm(warning)) return;
    const nextTree = cloneTree(registryRoot);
    const targetNode = findNodeByPath(nextTree, selectedPath);
    if (!targetNode) return;
    targetNode.values = targetNode.values.filter((v) => v.id !== val.id);
    setRegistryRoot(nextTree);
    setSelectedValueId(targetNode.values[0]?.id || null);
    addAuditLog('ELIMINAR_VALOR', selectedPath, val.name, val.data, undefined);
  };

  // Create a new subkey
  const handleCreateKey = (keyName: string, description: string): string | null => {
    const nextTree = cloneTree(registryRoot);
    const targetNode = findNodeByPath(nextTree, selectedPath);
    if (!targetNode) return null;
    if (NO_NEW_SUBKEY_PATHS.includes(targetNode.path.toLowerCase())) {
      return `Windows no permite crear claves directamente en «${targetNode.name}»: solo contiene las colmenas cargadas. Selecciona una subclave (por ejemplo SOFTWARE).`;
    }
    if (keyName.includes('\\')) {
      return 'El nombre de una clave no puede contener la barra invertida «\\».';
    }
    const newPath = `${targetNode.path}\\${keyName}`;
    if (targetNode.children.some((c) => c.name.toLowerCase() === keyName.toLowerCase())) {
      return `No se puede crear la clave: ya existe «${keyName}» en esta ubicación.`;
    }
    targetNode.children.push({
      name: keyName,
      path: newPath,
      hive: targetNode.hive,
      scopeLabel: targetNode.scopeLabel,
      description,
      values: [
        {
          id: newId('def'),
          name: '(Predeterminado)',
          type: 'REG_SZ',
          data: '',
          isDefault: true,
        },
      ],
      children: [],
    });
    setRegistryRoot(nextTree);
    setExpandedPaths((prev) => ({ ...prev, [targetNode.path]: true, [newPath]: true }));
    setSelectedPath(newPath);
    setAddressInput(newPath);
    setSelectedValueId(null);
    addAuditLog('CREAR_CLAVE', targetNode.path, keyName);
    return null;
  };

  // Reset entire registry to factory state
  const handleResetRegistry = () => {
    if (
      !window.confirm(
        'Se restaurará el Registro de fábrica y se perderán los cambios y casos resueltos (el historial de operaciones se conserva). ¿Continuar?'
      )
    ) {
      return;
    }
    const fresh = cloneTree(INITIAL_REGISTRY_TREE);
    setRegistryRoot(fresh);
    storageRemove(STORAGE_KEY);
    // La clave seleccionada puede ser una creada por el alumno que ya no existe
    if (!findNodeByPath(fresh, selectedPath)) {
      setSelectedPath('Equipo');
      setAddressInput('Equipo');
    }
    addAuditLog('RESTAURAR', 'Equipo', 'Valores de fábrica restaurados');
  };

  // Search across the entire Registry tree
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: {
      keyPath: string;
      keyName: string;
      matchType: 'Clave' | 'Valor' | 'Datos';
      valueName?: string;
      valueData?: string;
    }[] = [];

    function searchNode(node: RegistryKeyNode) {
      if (node.name.toLowerCase().includes(q)) {
        matches.push({
          keyPath: node.path,
          keyName: node.name,
          matchType: 'Clave',
        });
      }
      for (const v of node.values) {
        if (v.name.toLowerCase().includes(q)) {
          matches.push({
            keyPath: node.path,
            keyName: node.name,
            matchType: 'Valor',
            valueName: v.name,
            valueData: v.data,
          });
        } else if (v.data.toLowerCase().includes(q)) {
          matches.push({
            keyPath: node.path,
            keyName: node.name,
            matchType: 'Datos',
            valueName: v.name,
            valueData: v.data,
          });
        }
      }
      for (const child of node.children) {
        searchNode(child);
      }
    }

    searchNode(registryRoot);
    return matches.slice(0, 15);
  }, [registryRoot, searchQuery]);

  // Live OS Telemetry derived directly from current Registry values
  const liveOsState = useMemo(() => {
    const fastStartup = isFastStartupActive(registryRoot);
    const usbStart =
      getValueData(
        registryRoot,
        'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
        'Start'
      ) ?? '3';
    const installDir =
      getValueData(
        registryRoot,
        'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
        'ProgramFilesDir'
      ) ?? 'C:\\Program Files';
    // Cualquier valor distinto de 0 activa la directiva; sin el valor no hay bloqueo
    const taskMgrBlocked =
      (getValueData(
        registryRoot,
        'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'DisableTaskMgr'
      ) ?? '0') !== '0';
    // Sin HideFileExt, Windows oculta las extensiones conocidas (comportamiento por defecto)
    const extHidden =
      getValueData(
        registryRoot,
        'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        'HideFileExt'
      ) !== '0';
    const minerActive = isMinerActive(registryRoot);
    const longPaths =
      getValueData(
        registryRoot,
        'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
        'LongPathsEnabled'
      ) === '1';

    return {
      fastStartup,
      usbStart,
      installDir,
      taskMgrBlocked,
      extHidden,
      minerActive,
      longPaths,
    };
  }, [registryRoot]);

  // Recursive Tree Node renderer
  const renderTreeNode = (node: RegistryKeyNode, depth = 0) => {
    const isExpanded = Boolean(expandedPaths[node.path]);
    const isSelected = selectedPath.toLowerCase() === node.path.toLowerCase();
    const isPulsing = pulsingKeyPath?.toLowerCase() === node.path.toLowerCase();
    const hasChildren = node.children.length > 0;
    const isMissionTarget =
      activeMission.targetPath.toLowerCase() === node.path.toLowerCase();

    return (
      <div key={node.path} className="select-none">
        <div
          ref={(el) => {
            treeNodeRefs.current[node.path] = el;
          }}
          onClick={() => {
            setSelectedPath(node.path);
            setAddressInput(node.path);
            setSelectedValueId(node.values[0]?.id || null);
            if (!isExpanded && hasChildren) {
              setExpandedPaths((prev) => ({ ...prev, [node.path]: true }));
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`group flex items-center gap-1.5 py-1 pr-2 text-xs cursor-pointer transition-colors ${
            isPulsing
              ? 'animate-regedit-pulse bg-sky-600 text-white font-semibold ring-2 ring-amber-400 ring-inset shadow-sm'
              : isSelected
              ? 'bg-sky-600 text-white font-medium'
              : isMissionTarget
              ? 'bg-amber-50 text-slate-900 hover:bg-slate-100 font-medium'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.path);
              }}
              className={`p-0.5 rounded ${
                isSelected ? 'text-white hover:bg-sky-700' : 'text-slate-400 hover:text-slate-700'
              }`}
              aria-label={isExpanded ? 'Contraer clave' : 'Expandir clave'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          {isExpanded ? (
            <FolderOpen
              className={`h-3.5 w-3.5 shrink-0 ${
                isSelected ? 'text-amber-200' : 'text-amber-500'
              }`}
            />
          ) : (
            <Folder
              className={`h-3.5 w-3.5 shrink-0 ${
                isSelected ? 'text-amber-200' : 'text-amber-500'
              }`}
            />
          )}

          <span className="truncate font-mono text-[11.5px]">{node.name}</span>

          {isPulsing && (
            <span className="ml-auto text-[10px] font-mono font-bold text-amber-300 shrink-0">
              ● LOCALIZADO
            </span>
          )}

          {isMissionTarget && !isSelected && !isPulsing && (
            <span
              title="Objetivo del caso práctico activo"
              className="ml-auto text-[10px] font-mono font-semibold text-amber-700 shrink-0"
            >
              ★
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 text-slate-900"
      onClick={() => setOpenMenu(null)}
    >
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Brand Lockup */}
        <a
          href="https://www.unfantasmaenelsistema.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900 min-w-0 group"
        >
          {!logoError ? (
            <img
              src="./assets/aistudio/icono_81a3db5b.png"
              alt="Logo Un Fantasma en el Sistema"
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-8 w-8 object-contain rounded shrink-0 transition-transform group-hover:scale-105"
            />
          ) : (
            <Terminal className="h-6 w-6 text-sky-600 shrink-0" />
          )}
          <span className="truncate">RegEdit Lab · Un Fantasma en el Sistema</span>
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveMainView('simulator')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeMainView === 'simulator'
                ? 'text-sky-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            Simulador Regedit
          </button>
          <button
            type="button"
            onClick={() => setActiveMainView('missions')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeMainView === 'missions'
                ? 'text-sky-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            Casos Prácticos ({completedCount}/{DIDACTIC_MISSIONS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMainView('comparator')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeMainView === 'comparator'
                ? 'text-sky-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            HKLM vs HKCU
          </button>
          <button
            type="button"
            onClick={() => setActiveMainView('guide')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeMainView === 'guide'
                ? 'text-sky-600 underline underline-offset-8 decoration-2'
                : 'hover:text-slate-900'
            }`}
          >
            Guía de Tipos y Claves
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Link */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <a
            href="https://www.unfantasmaenelsistema.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <span>Web Un Fantasma en el Sistema</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="flex lg:hidden items-center gap-2 overflow-x-auto px-4 py-2 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMainView('simulator')}
          className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
            activeMainView === 'simulator'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Simulador Regedit
        </button>
        <button
          type="button"
          onClick={() => setActiveMainView('missions')}
          className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
            activeMainView === 'missions'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Casos Prácticos ({completedCount}/{DIDACTIC_MISSIONS.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveMainView('comparator')}
          className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
            activeMainView === 'comparator'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          HKLM vs HKCU
        </button>
        <button
          type="button"
          onClick={() => setActiveMainView('guide')}
          className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap shrink-0 ${
            activeMainView === 'guide'
              ? 'bg-sky-600 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Guía de Claves
        </button>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5">
        {activeMainView === 'comparator' && (
          <HklmVsHkcuComparator onJumpToPath={(p) => navigateToPath(p)} />
        )}

        {activeMainView === 'guide' && (
          <RegistryTypesAndHivesGuide onJumpToPath={(p) => navigateToPath(p)} />
        )}

        {activeMainView === 'missions' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Laboratorio de Casos Prácticos de Administración en Regedit
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Resuelve incidencias reales de arranque, seguridad, directivas y almacenamiento modificando el Registro de Windows.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                  Progreso: {completedCount} / {DIDACTIC_MISSIONS.length} completados
                </span>
                <button
                  type="button"
                  onClick={handleResetRegistry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar Registro Inicial
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DIDACTIC_MISSIONS.map((mission) => {
                const isDone = missionResults[mission.id];
                return (
                  <div
                    key={mission.id}
                    className={`rounded-md border p-4 flex flex-col justify-between gap-4 bg-white transition-colors ${
                      isDone ? 'border-emerald-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-slate-900">Caso {mission.number}</span>
                          <span aria-hidden="true">·</span>
                          <span>{mission.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-sky-700 font-semibold">{mission.hiveFocus}</span>
                        </div>
                        <span
                          className={`font-mono font-semibold flex items-center gap-1 ${
                            isDone ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isDone ? (
                            <>
                              <CheckCircle2 className="h-4 w-4" /> RESUELTO
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-4 w-4" /> PENDIENTE
                            </>
                          )}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">{mission.title}</h3>

                      <p className="text-xs text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">Incidencia: </strong>
                        {mission.symptom}
                      </p>

                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200/80">
                        <strong className="text-slate-800">Fundamento HKLM vs HKCU: </strong>
                        {mission.didacticExplanation}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <code className="text-[11px] font-mono text-slate-600">
                        Objetivo: {mission.expectedSummary}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveMissionId(mission.id);
                          navigateToPath(mission.targetPath, mission.targetValueName);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Resolver en Simulador →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeMainView === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT / MAIN ZONE (8 cols on 12-col desktop grid): Interactive Windows regedit.exe Replica */}
            <div className="lg:col-span-8 rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden flex flex-col">
              {/* Windows 10/11 Native Regedit Title Bar */}
              <div className="flex items-center justify-between bg-slate-900 text-white px-3.5 py-2 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5 shrink-0">
                    <span className="bg-sky-400 rounded-[1px]" />
                    <span className="bg-sky-500 rounded-[1px]" />
                    <span className="bg-sky-600 rounded-[1px]" />
                    <span className="bg-sky-300 rounded-[1px]" />
                  </div>
                  <span className="text-xs font-medium truncate">
                    Editor del Registro (regedit.exe) — Administrador
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBootModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3 w-3" />
                    Simular Reinicio / Probar Sistema
                  </button>
                </div>
              </div>

              {/* Regedit Menu Bar (Archivo, Edición, Ver, Favoritos) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 border-b border-slate-200 px-2 py-1 text-xs">
                <div className="flex flex-wrap items-center gap-1 relative">
                  {/* Archivo Menu */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
                      className="px-2.5 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap"
                    >
                      Archivo
                    </button>
                    {openMenu === 'file' && (
                      <div className="absolute left-0 top-full mt-1 w-56 rounded border border-slate-300 bg-white shadow-lg py-1 z-40">
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportModal(true);
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white flex items-center gap-2"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Exportar rama a archivo .reg...
                        </button>
                        <div className="my-1 border-t border-slate-200" />
                        <button
                          type="button"
                          onClick={() => {
                            handleResetRegistry();
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-700 hover:bg-red-600 hover:text-white flex items-center gap-2"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar Registro de fábrica
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Edición Menu */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
                      className="px-2.5 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap"
                    >
                      Edición
                    </button>
                    {openMenu === 'edit' && (
                      <div className="absolute left-0 top-full mt-1 w-64 rounded border border-slate-300 bg-white shadow-lg py-1 z-40">
                        <button
                          type="button"
                          onClick={() => {
                            setCreateModalMode('key');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white flex items-center gap-2"
                        >
                          <Folder className="h-3.5 w-3.5" />
                          Nueva → Clave (Subcarpeta)
                        </button>
                        <div className="my-1 border-t border-slate-200" />
                        <button
                          type="button"
                          onClick={() => {
                            setCreateInitialType('REG_SZ');
                            setCreateModalMode('value');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white"
                        >
                          Nuevo → Valor de cadena (REG_SZ)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateInitialType('REG_DWORD');
                            setCreateModalMode('value');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white"
                        >
                          Nuevo → Valor DWORD (32 bits)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateInitialType('REG_QWORD');
                            setCreateModalMode('value');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white"
                        >
                          Nuevo → Valor QWORD (64 bits)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateInitialType('REG_EXPAND_SZ');
                            setCreateModalMode('value');
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white"
                        >
                          Nuevo → Valor de cadena expandible
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Favoritos Menu */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setOpenMenu(openMenu === 'favorites' ? null : 'favorites')}
                      className="px-2.5 py-1 rounded hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1 whitespace-nowrap"
                    >
                      <Bookmark className="h-3 w-3 text-sky-600" />
                      Favoritos Didácticos
                    </button>
                    {openMenu === 'favorites' && (
                      <div className="absolute left-0 top-full mt-1 w-80 rounded border border-slate-300 bg-white shadow-lg py-1 z-40">
                        <div className="px-3 py-1 text-[10px] font-mono font-semibold text-slate-400">
                          ACCESOS DIRECTOS A CLAVES DEL LABORATORIO
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
                              'HiberbootEnabled'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKLM] Inicio Rápido (Power\HiberbootEnabled)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKCU] Programas de Inicio del Usuario (Run)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKLM] Programas de Inicio Globales (Run)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
                              'Start'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKLM] Bloqueo de Puertos USB (Services\USBSTOR)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
                              'ProgramFilesDir'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKLM] Rutas de Instalación (ProgramFilesDir)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
                              'DisableTaskMgr'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKCU] Directivas y TaskMgr (Policies\System)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateToPath(
                              'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
                              'HideFileExt'
                            );
                            setOpenMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-600 hover:text-white truncate"
                        >
                          [HKCU] Extensiones de Archivo (Explorer\Advanced)
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={expandAll}
                    className="px-2 py-1 rounded hover:bg-slate-200 text-slate-600 text-[11px] whitespace-nowrap"
                  >
                    Expandir árbol
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="px-2 py-1 rounded hover:bg-slate-200 text-slate-600 text-[11px] whitespace-nowrap"
                  >
                    Contraer
                  </button>
                </div>

                {/* Quick Action Toolbar Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateInitialType('REG_DWORD');
                      setCreateModalMode('value');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3 w-3 text-sky-600" />
                    Nuevo Valor
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateModalMode('key')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Folder className="h-3 w-3 text-amber-500" />
                    Nueva Clave
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileDown className="h-3 w-3 text-slate-600" />
                    .reg
                  </button>
                </div>
              </div>

              {/* Address Bar + Search Box */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 p-2 bg-slate-50 border-b border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const resolved = resolveRegistryAddress(addressInput);
                    if (resolved && findNodeByPath(registryRoot, resolved)) {
                      navigateToPath(resolved);
                    } else {
                      setAddressError(
                        resolved
                          ? 'Esa clave no existe en el simulador. Comprueba la ruta o usa el buscador.'
                          : 'La ruta debe empezar por una rama: HKLM, HKCU, HKCR, HKU o HKCC (o su nombre completo).'
                      );
                    }
                  }}
                  className="md:col-span-8 flex items-center gap-1.5"
                >
                  <span className="text-[11px] font-mono text-slate-500 pl-1 shrink-0">Ruta:</span>
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => {
                      setAddressInput(e.target.value);
                      setAddressError(null);
                    }}
                    aria-label="Barra de direcciones del Registro"
                    title="Admite rutas como HKLM\SYSTEM\CurrentControlSet\Services\USBSTOR; pulsa Intro para ir"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-sky-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // Como «Copiar nombre de clave» de regedit: sin el prefijo «Equipo\»
                      navigator.clipboard
                        ?.writeText(selectedPath.replace(/^Equipo\\?/, ''))
                        .then(() => {
                          setCopiedPath(true);
                          setTimeout(() => setCopiedPath(false), 1500);
                        })
                        .catch(() => {
                          // Portapapeles no disponible (contexto no seguro o permiso denegado)
                        });
                    }}
                    title="Copiar nombre de clave"
                    className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
                  >
                    {copiedPath ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </form>

                {/* Live Search Input */}
                <div className="md:col-span-4 relative">
                  <div className="relative flex items-center">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          e.preventDefault();
                          const first = searchResults[0];
                          navigateToPath(first.keyPath, first.valueName, true);
                          setSearchQuery('');
                        } else if (e.key === 'Escape') {
                          setSearchQuery('');
                        }
                      }}
                      placeholder="Buscar clave o valor (ej: USBSTOR, Run)..."
                      className="w-full rounded border border-slate-300 bg-white pl-8 pr-6 py-1 text-xs text-slate-800 focus:border-sky-600 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-xs text-slate-400 hover:text-slate-700"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Instant Search Results Popover */}
                  {searchQuery.trim() !== '' && (
                    <div className="absolute right-0 top-full mt-1 w-full sm:w-96 max-h-72 overflow-y-auto rounded border border-slate-300 bg-white shadow-xl z-40 divide-y divide-slate-100">
                      <div className="px-2.5 py-1.5 bg-slate-50 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                        <span>{searchResults.length} coincidencias encontradas</span>
                        <span>Clic o Enter para resaltar en árbol</span>
                      </div>
                      {searchResults.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          No se encontraron claves ni valores que coincidan con "{searchQuery}".
                        </div>
                      ) : (
                        searchResults.map((res, idx) => (
                          <button
                            key={`${res.keyPath}-${res.valueName || idx}`}
                            type="button"
                            onClick={() => {
                              navigateToPath(res.keyPath, res.valueName, true);
                              setSearchQuery('');
                            }}
                            className="w-full text-left p-2.5 hover:bg-sky-50 transition-colors flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-mono font-semibold text-sky-700">
                                [{res.matchType}] {res.valueName || res.keyName}
                              </span>
                              {res.valueData && (
                                <span className="font-mono text-slate-500 truncate max-w-[140px]">
                                  = {res.valueData}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 truncate">
                              {res.keyPath}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {addressError && (
                  <p role="alert" className="md:col-span-12 text-[11px] text-red-700 pl-1">
                    {addressError}
                  </p>
                )}
              </div>

              {/* Contextual Scope Banner (HKLM vs HKCU Educational Indicator + Mirror Key Jump) */}
              <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {selectedNode.hive === 'HKLM' ? (
                    <HardDrive className="h-4 w-4 text-sky-700 shrink-0" />
                  ) : selectedNode.hive === 'HKCU' ? (
                    <User className="h-4 w-4 text-emerald-700 shrink-0" />
                  ) : (
                    <FolderOpen className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                  <div className="text-xs truncate">
                    <span className="font-semibold text-slate-900">{selectedNode.scopeLabel}</span>
                  </div>
                </div>

                {selectedNode.equivalentPath && (
                  <button
                    type="button"
                    onClick={() => navigateToPath(selectedNode.equivalentPath!)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-semibold text-sky-700 bg-white border border-sky-300 rounded hover:bg-sky-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    Comparar con clave espejo en {selectedNode.hive === 'HKLM' ? 'HKCU' : 'HKLM'}
                  </button>
                )}
              </div>

              {/* Split Pane: Left Tree View + Right Values Table */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Left Pane: Hierarchy Tree (5 cols) */}
                <div className="md:col-span-5 overflow-y-auto max-h-[460px] py-2 bg-white">
                  {renderTreeNode(registryRoot)}
                </div>

                {/* Right Pane: Values List + Contextual Value Inspector (7 cols) */}
                <div className="md:col-span-7 flex flex-col justify-between bg-white max-h-[460px] overflow-hidden">
                  <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <tr>
                          <th className="py-2 px-3">Nombre</th>
                          <th className="py-2 px-2">Tipo</th>
                          <th className="py-2 px-3">Datos</th>
                          <th className="py-2 px-2 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {selectedNode.values.map((val) => {
                          const isValSelected = selectedValue?.id === val.id;
                          const isNumeric =
                            val.type === 'REG_DWORD' || val.type === 'REG_QWORD' || val.type === 'REG_BINARY';
                          const isTargetValue =
                            activeMission.targetPath.toLowerCase() ===
                              selectedNode.path.toLowerCase() &&
                            activeMission.targetValueName.toLowerCase() === val.name.toLowerCase();

                          return (
                            <tr
                              key={val.id}
                              onClick={() => setSelectedValueId(val.id)}
                              onDoubleClick={() => setEditingValue(val)}
                              className={`cursor-pointer transition-colors ${
                                isValSelected
                                  ? 'bg-sky-50/90 text-slate-900'
                                  : isTargetValue
                                  ? 'bg-amber-50/60 hover:bg-slate-50'
                                  : 'hover:bg-slate-50 text-slate-800'
                              }`}
                            >
                              <td className="py-2 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-4 text-[9px] font-bold rounded-[2px] border ${
                                      isNumeric
                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                    }`}
                                  >
                                    {isNumeric ? '010' : 'ab'}
                                  </span>
                                  <span className="font-medium text-xs">{val.name}</span>
                                  {isTargetValue && (
                                    <span className="text-[10px] font-sans font-semibold text-amber-700">
                                      ★ Objetivo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-[11px] text-slate-500 whitespace-nowrap">
                                {val.type}
                              </td>
                              <td className="py-2 px-3 text-xs text-slate-700 tabular-nums max-w-[200px] truncate">
                                {formatRegistryDataForDisplay(val)}
                              </td>
                              <td className="py-2 px-2 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingValue(val);
                                    }}
                                    title="Modificar valor (o haz doble clic en la fila)"
                                    className="px-2 py-0.5 text-[11px] font-sans font-medium text-sky-700 bg-white border border-slate-200 rounded hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-colors"
                                  >
                                    Modificar
                                  </button>
                                  {!val.isDefault && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteValue(val);
                                      }}
                                      title="Eliminar valor"
                                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Didactic Inspector for Selected Key / Value */}
                  <div className="border-t border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5 text-sky-600" />
                          <span>Explicación Didáctica de la Clave y Valor Activo</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {selectedValue && !selectedValue.isDefault && selectedValue.description
                            ? selectedValue.description
                            : selectedNode.description}
                        </p>
                      </div>
                      {selectedValue && (
                        <button
                          type="button"
                          onClick={() => setEditingValue(selectedValue)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="h-3 w-3" />
                          Editar valor
                        </button>
                      )}
                    </div>

                    {selectedNode.precedenceNote && (
                      <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/80">
                        <strong className="text-slate-800">Jerarquía HKLM vs HKCU: </strong>
                        {selectedNode.precedenceNote}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Regedit Bottom Status Bar */}
              <div className="bg-slate-100 border-t border-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-600">
                <span className="truncate">{selectedNode.path}</span>
                <span className="shrink-0 tabular-nums">
                  {selectedNode.children.length} subclaves · {selectedNode.values.length} valores
                </span>
              </div>
            </div>

            {/* RIGHT ZONE (4 cols on 12-col desktop grid): Interactive Didactic Deck & Live System Monitor */}
            <div className="lg:col-span-4 space-y-4">
              {/* Active Troubleshooting Case Card */}
              <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-[11px] font-mono font-semibold text-sky-700">
                      Entrenador Práctico ({completedCount}/{DIDACTIC_MISSIONS.length} superados)
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      Selecciona un Caso Real a Resolver
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveMainView('missions')}
                    className="text-xs font-medium text-sky-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    Ver todos
                  </button>
                </div>

                {/* Mission Selector Dropdown */}
                <div>
                  <select
                    aria-label="Seleccionar caso práctico"
                    value={activeMission.id}
                    onChange={(e) => {
                      setActiveMissionId(e.target.value);
                      setShowHint(false);
                    }}
                    className="w-full rounded border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {DIDACTIC_MISSIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {missionResults[m.id] ? '✓ ' : '○ '}Caso {m.number}: {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mission Status & Details */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>
                      Rama objetivo: <strong className="text-slate-800">{activeMission.hiveFocus}</strong>
                    </span>
                    {missionResults[activeMission.id] ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> ● CASO RESUELTO
                      </span>
                    ) : (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> ▲ PENDIENTE
                      </span>
                    )}
                  </div>

                  <div className="rounded bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                    <p className="text-slate-800 leading-relaxed">
                      <strong className="text-slate-900">Problema reportado: </strong>
                      {activeMission.symptom}
                    </p>
                    <p className="text-slate-600 leading-relaxed pt-1 border-t border-slate-200/70">
                      <strong className="text-slate-800">Por qué en {activeMission.hiveFocus}: </strong>
                      {activeMission.didacticExplanation}
                    </p>
                  </div>

                  {/* Action Buttons for Current Mission */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigateToPath(activeMission.targetPath, activeMission.targetValueName)
                      }
                      className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors text-center whitespace-nowrap"
                    >
                      Ir a la clave en Regedit
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHint(!showHint)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      {showHint ? 'Ocultar pista' : 'Ver pista'}
                    </button>
                  </div>

                  {showHint && (
                    <div className="rounded border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-slate-800 space-y-1">
                      <p className="font-semibold text-amber-900">Pista de resolución:</p>
                      <p>{activeMission.hint}</p>
                      <p className="font-mono text-[11px] text-amber-800">
                        Resultado esperado: {activeMission.expectedSummary}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Windows System Impact Monitor */}
              <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-sky-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Estado del Equipo Simulado en Tiempo Real
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">En vivo</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Inicio Rápido (HKLM\...\Power):</span>
                    <span
                      className={`font-mono font-medium ${
                        !liveOsState.fastStartup ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {!liveOsState.fastStartup ? '● Desactivado (Apagado completo)' : '▲ Activo (Apagado híbrido)'}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Puertos USB (USBSTOR\Start):</span>
                    <span
                      className={`font-mono font-medium ${
                        liveOsState.usbStart === '4' ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {liveOsState.usbStart === '4'
                        ? '● 4 (Bloqueados DLP)'
                        : `○ ${liveOsState.usbStart} (Habilitados)`}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Sesión Usuario (HKCU\...\Run):</span>
                    {liveOsState.minerActive ? (
                      <span className="font-mono font-medium text-red-700 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Malware Activo
                      </span>
                    ) : (
                      <span className="font-mono font-medium text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Limpio
                      </span>
                    )}
                  </div>

                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Ruta Instalación 64 bits:</span>
                    <code className="font-mono text-slate-900 font-semibold truncate max-w-[150px]">
                      {liveOsState.installDir}
                    </code>
                  </div>

                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Administrador de Tareas:</span>
                    <span
                      className={`font-mono font-medium ${
                        liveOsState.taskMgrBlocked ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {liveOsState.taskMgrBlocked ? '▲ Bloqueado' : '● Operativo'}
                    </span>
                  </div>

                  <div className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-600">Extensiones de Archivo:</span>
                    <span
                      className={`font-mono font-medium ${
                        liveOsState.extHidden ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {liveOsState.extHidden ? '▲ Ocultas (Riesgo)' : '● Visibles'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBootModal(true)}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="h-3.5 w-3.5 text-sky-600" />
                  Abrir Banco de Pruebas de Arranque y Sesión
                </button>
              </div>

              {/* Session Audit Log & Student Submission Export */}
              <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <History className="h-4 w-4 text-slate-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Historial de Operaciones
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {auditLogs.length} eventos
                    </span>
                    {auditLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuditLogs([]);
                          storageRemove(`${STORAGE_KEY}_logs`);
                        }}
                        className="text-[11px] text-slate-400 hover:text-red-600 transition-colors"
                        title="Vaciar historial de eventos"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Student Name for Submission */}
                <div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Nombre del alumno / grupo (para la entrega)..."
                    aria-label="Nombre del alumno o grupo para el informe"
                    className="w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none"
                  />
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-1.5">
                    Aún no has modificado ninguna clave. Haz doble clic sobre cualquier valor en la tabla para editarlo.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-[11px] font-mono">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="py-1.5 space-y-0.5">
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-semibold text-sky-700">{log.action}</span>
                          <span className="text-slate-400 tabular-nums">{log.timestamp}</span>
                        </div>
                        <div className="text-slate-800 truncate">
                          {log.targetName}{' '}
                          {log.newValue !== undefined && (
                            <span className="text-emerald-700">
                              ({log.oldValue ?? '∅'} → {log.newValue})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Download Log & Solved Cases Buttons (.txt & .csv) */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="block text-[11px] text-slate-500">
                    Exportar entrega con ejercicios resueltos ({completedCount}/{DIDACTIC_MISSIONS.length}) y log:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadLogTxt}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Descargar .txt
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadLogCsv}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      <FileDown className="h-3.5 w-3.5 text-slate-600" />
                      Descargar .csv
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clean Educational Footer with Brand Logo and Link */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            {!logoError && (
              <img
                src="./assets/aistudio/icono_81a3db5b.png"
                alt="Un Fantasma en el Sistema"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-7 w-7 object-contain"
              />
            )}
            <span>
              Simulador Didáctico del Registro de Windows (<code className="font-mono">regedit.exe</code>) · Desarrollado para{' '}
              <a
                href="https://www.unfantasmaenelsistema.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-slate-900 hover:text-sky-600 underline underline-offset-4"
              >
                unfantasmaenelsistema.com
              </a>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={handleResetRegistry}
              className="text-slate-600 hover:text-slate-900 underline underline-offset-4 whitespace-nowrap"
            >
              Restablecer valores de fábrica
            </button>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.unfantasmaenelsistema.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-700 hover:text-sky-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Visitar Un Fantasma en el Sistema <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ValueEditModal
        value={editingValue}
        keyPath={selectedNode.path}
        onClose={() => setEditingValue(null)}
        onSave={handleSaveValue}
      />

      <CreateItemModal
        mode={createModalMode}
        initialValueType={createInitialType}
        keyPath={selectedNode.path}
        onClose={() => setCreateModalMode(null)}
        onCreateKey={handleCreateKey}
        onCreateValue={handleCreateValue}
      />

      {showExportModal && (
        <RegExportModal node={selectedNode} onClose={() => setShowExportModal(false)} />
      )}

      {showBootModal && (
        <BootSimulatorModal
          root={registryRoot}
          onClose={() => setShowBootModal(false)}
          onNavigateToKey={(path) => navigateToPath(path)}
        />
      )}
    </div>
  );
}
