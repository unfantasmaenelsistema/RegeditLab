import { MissionScenario, RegistryKeyNode } from '../types/registry';

export { formatRegistryDataForDisplay } from '../engine/registryEngine';

export function findNodeByPath(root: RegistryKeyNode, targetPath: string): RegistryKeyNode | null {
  if (root.path.toLowerCase() === targetPath.toLowerCase()) {
    return root;
  }
  for (const child of root.children) {
    const found = findNodeByPath(child, targetPath);
    if (found) return found;
  }
  return null;
}

export function getValueData(root: RegistryKeyNode, keyPath: string, valueName: string): string | undefined {
  const node = findNodeByPath(root, keyPath);
  if (!node) return undefined;
  const val = node.values.find((v) => v.name.toLowerCase() === valueName.toLowerCase());
  return val?.data;
}

const RUN_KEYS = [
  'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
];

/**
 * El minero sigue activo mientras alguna entrada Run apunte a miner_svc.exe,
 * se llame como se llame el valor: renombrarlo o moverlo a HKLM no lo neutraliza.
 */
export function isMinerActive(root: RegistryKeyNode): boolean {
  return RUN_KEYS.some((path) =>
    findNodeByPath(root, path)?.values.some((v) => v.data.toLowerCase().includes('miner_svc.exe'))
  );
}

/**
 * El Inicio Rápido es una hibernación parcial: si falta HiberbootEnabled se toma
 * como 1 (valor por defecto) y también se apaga si se desactiva la hibernación entera.
 */
export function isFastStartupActive(root: RegistryKeyNode): boolean {
  const hiberboot = getValueData(
    root,
    'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
    'HiberbootEnabled'
  );
  const hibernate = getValueData(
    root,
    'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power',
    'HibernateEnabled'
  );
  return hiberboot !== '0' && hibernate !== '0';
}

export const INITIAL_REGISTRY_TREE: RegistryKeyNode = {
  name: 'Equipo',
  path: 'Equipo',
  hive: 'ROOT',
  scopeLabel: 'Nodo Raíz del Registro de Windows',
  description:
    'Contenedor raíz de las 5 ramas principales (Hives) del Registro de Windows. En realidad, solo HKEY_LOCAL_MACHINE y HKEY_USERS existen físicamente como archivos de colmena en disco; las demás ramas son vistas simbólicas o enlaces dinámicos a subclaves de estas dos.',
  values: [],
  children: [
    {
      name: 'HKEY_CLASSES_ROOT',
      path: 'Equipo\\HKEY_CLASSES_ROOT',
      hive: 'HKCR',
      scopeLabel: 'Asociaciones de archivos y objetos COM (Vista fusionada HKLM + HKCU)',
      description:
        'Define qué aplicación abre cada extensión de archivo (.txt, .pdf, .exe) y registra objetos COM. Es una vista combinada de HKLM\\SOFTWARE\\Classes (global) y HKCU\\Software\\Classes (usuario). Si existe conflicto, prevalece la configuración del usuario actual (HKCU).',
      values: [
        {
          id: 'hkcr-def',
          name: '(Predeterminado)',
          type: 'REG_SZ',
          data: '',
          isDefault: true,
          description: 'Valor predeterminado de la raíz de clases.'
        }
      ],
      children: [
        {
          name: '.txt',
          path: 'Equipo\\HKEY_CLASSES_ROOT\\.txt',
          hive: 'HKCR',
          scopeLabel: 'Asociación de extensión .txt',
          description: 'Vincula la extensión .txt con el identificador de programa (ProgID) "txtfile".',
          values: [
            {
              id: 'hkcr-txt-def',
              name: '(Predeterminado)',
              type: 'REG_SZ',
              data: 'txtfile',
              isDefault: true,
              description: 'ProgID que determina cómo Windows procesa archivos de texto plano.'
            },
            {
              id: 'hkcr-txt-mime',
              name: 'Content Type',
              type: 'REG_SZ',
              data: 'text/plain',
              description: 'Tipo MIME estándar asociado a archivos .txt.'
            }
          ],
          children: []
        },
        {
          name: '.reg',
          path: 'Equipo\\HKEY_CLASSES_ROOT\\.reg',
          hive: 'HKCR',
          scopeLabel: 'Asociación de scripts de Registro (.reg)',
          description: 'Define que los archivos .reg sean importados por regedit.exe al hacer doble clic.',
          values: [
            {
              id: 'hkcr-reg-def',
              name: '(Predeterminado)',
              type: 'REG_SZ',
              data: 'regfile',
              isDefault: true,
              description: 'Si se cambia a "txtfile", los archivos .reg se abrirán en el Bloc de notas en vez de ejecutarse.'
            }
          ],
          children: []
        }
      ]
    },
    {
      name: 'HKEY_CURRENT_USER',
      path: 'Equipo\\HKEY_CURRENT_USER',
      hive: 'HKCU',
      scopeLabel: 'Ámbito Local: Solo afecta al usuario con sesión iniciada (NTUSER.DAT)',
      description:
        'Contiene la configuración específica del usuario actual (C:\\Users\\<Usuario>\\NTUSER.DAT). Modificar claves aquí NO afecta a otros usuarios del equipo ni requiere privilegios de Administrador en la mayoría de subclaves, salvo en Policies.',
      values: [
        {
          id: 'hkcu-def',
          name: '(Predeterminado)',
          type: 'REG_SZ',
          data: '',
          isDefault: true
        }
      ],
      children: [
        {
          name: 'Control Panel',
          path: 'Equipo\\HKEY_CURRENT_USER\\Control Panel',
          hive: 'HKCU',
          scopeLabel: 'Preferencias del Panel de Control del usuario activo',
          description: 'Almacena ajustes visuales, ratón, teclado y accesibilidad del perfil actual.',
          values: [
            { id: 'hkcu-cp-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'Desktop',
              path: 'Equipo\\HKEY_CURRENT_USER\\Control Panel\\Desktop',
              hive: 'HKCU',
              scopeLabel: 'Comportamiento del Escritorio y cierre de sesión del usuario',
              description: 'Controla fondos de pantalla, tiempos de respuesta de menús y cierre forzado de aplicaciones al apagar.',
              values: [
                { id: 'hkcu-desk-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                {
                  id: 'hkcu-desk-wall',
                  name: 'Wallpaper',
                  type: 'REG_SZ',
                  data: 'C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg',
                  description: 'Ruta de la imagen de fondo del escritorio del usuario actual.'
                },
                {
                  id: 'hkcu-desk-menu',
                  name: 'MenuShowDelay',
                  type: 'REG_SZ',
                  data: '400',
                  description: 'Tiempo de espera en milisegundos (ms) antes de desplegar un menú contextual. Reducirlo a 100 acelera la interfaz.'
                },
                {
                  id: 'hkcu-desk-autoend',
                  name: 'AutoEndTasks',
                  type: 'REG_SZ',
                  data: '0',
                  description: 'Si vale 1, Windows cierra automáticamente programas bloqueados al apagar sin preguntar al usuario.',
                  allowedGuide: [
                    { value: '0', label: 'Preguntar antes de forzar el cierre de apps al apagar (Estándar)', impact: 'nominal' },
                    { value: '1', label: 'Forzar cierre automático de tareas colgadas al apagar', impact: 'warning' }
                  ]
                },
                {
                  id: 'hkcu-desk-ver',
                  name: 'PaintDesktopVersion',
                  type: 'REG_DWORD',
                  data: '0',
                  description: 'Muestra la compilación exacta de Windows en la esquina inferior derecha del escritorio.',
                  allowedGuide: [
                    { value: '0', label: 'Ocultar marca de agua de versión', impact: 'nominal' },
                    { value: '1', label: 'Mostrar versión y build de Windows en el escritorio', impact: 'nominal' }
                  ]
                }
              ],
              children: []
            },
            {
              name: 'Mouse',
              path: 'Equipo\\HKEY_CURRENT_USER\\Control Panel\\Mouse',
              hive: 'HKCU',
              scopeLabel: 'Configuración de botones y sensibilidad del ratón (Usuario)',
              description: 'Permite invertir los botones izquierdo/derecho para usuarios zurdos o ajustar la sensibilidad.',
              values: [
                { id: 'hkcu-mouse-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                {
                  id: 'hkcu-mouse-swap',
                  name: 'SwapMouseButtons',
                  type: 'REG_SZ',
                  data: '0',
                  description: 'Invierte el clic principal del ratón (0 = Diestro, 1 = Zurdo).',
                  allowedGuide: [
                    { value: '0', label: 'Botón izquierdo como principal (Diestro)', impact: 'nominal' },
                    { value: '1', label: 'Botón derecho como principal (Zurdo)', impact: 'warning' }
                  ]
                },
                {
                  id: 'hkcu-mouse-sens',
                  name: 'MouseSensitivity',
                  type: 'REG_SZ',
                  data: '10',
                  description: 'Sensibilidad del puntero entre 1 (muy lento) y 20 (muy rápido). Valor por defecto: 10.'
                }
              ],
              children: []
            }
          ]
        },
        {
          name: 'Environment',
          path: 'Equipo\\HKEY_CURRENT_USER\\Environment',
          hive: 'HKCU',
          scopeLabel: 'Variables de entorno exclusivas del usuario activo',
          description: 'Define variables como %TEMP% o rutas añadidas al %PATH% únicamente para este usuario.',
          values: [
            { id: 'hkcu-env-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
            {
              id: 'hkcu-env-path',
              name: 'Path',
              type: 'REG_EXPAND_SZ',
              data: '%USERPROFILE%\\AppData\\Local\\Microsoft\\WindowsApps;',
              description: 'Rutas de búsqueda de ejecutables del usuario actual. Se concatena detrás del PATH del sistema (HKLM).'
            },
            {
              id: 'hkcu-env-temp',
              name: 'TEMP',
              type: 'REG_EXPAND_SZ',
              data: '%USERPROFILE%\\AppData\\Local\\Temp',
              description: 'Directorio de archivos temporales de las aplicaciones del usuario.'
            }
          ],
          children: []
        },
        {
          name: 'Software',
          path: 'Equipo\\HKEY_CURRENT_USER\\Software',
          hive: 'HKCU',
          scopeLabel: 'Configuración de aplicaciones instaladas para el usuario actual',
          description: 'Cada fabricante crea aquí su clave para guardar preferencias por usuario. Tiene su espejo global en HKLM\\SOFTWARE.',
          equivalentPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE',
          precedenceNote:
            'En preferencias de usuario (ej. idioma o tema), HKCU tiene prioridad sobre el valor por defecto de HKLM. Sin embargo, en subclaves Policies, las directivas de equipo (HKLM) tienen prioridad sobre HKCU.',
          values: [
            { id: 'hkcu-soft-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'Microsoft',
              path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft',
              hive: 'HKCU',
              scopeLabel: 'Preferencias de productos Microsoft para el usuario actual',
              description: 'Contiene la configuración de Windows, Office, Edge y herramientas del sistema para esta cuenta.',
              values: [
                { id: 'hkcu-ms-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
              ],
              children: [
                {
                  name: 'Windows',
                  path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows',
                  hive: 'HKCU',
                  scopeLabel: 'Ajustes del entorno operativo Windows del usuario',
                  description: 'Subclave principal del entorno gráfico y de sesión del usuario.',
                  values: [
                    { id: 'hkcu-win-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                  ],
                  children: [
                    {
                      name: 'CurrentVersion',
                      path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion',
                      hive: 'HKCU',
                      scopeLabel: 'Configuración de sesión actual, inicio y Explorador (Usuario)',
                      description: 'Contiene claves críticas como Run (programas de inicio del usuario), Explorer y Policies.',
                      equivalentPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
                      values: [
                        { id: 'hkcu-cv-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                      ],
                      children: [
                        {
                          name: 'Run',
                          path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
                          hive: 'HKCU',
                          scopeLabel: 'Inicio automático de programas (Solo al iniciar sesión este usuario)',
                          description:
                            'Todos los programas listados aquí se ejecutan automáticamente DESPUÉS de que este usuario inicia sesión y con sus permisos estándar. Es el lugar favorito del malware sin privilegios de administrador para lograr persistencia.',
                          equivalentPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
                          precedenceNote:
                            'Ambas listas se suman: al iniciar sesión Explorer lanza las entradas de HKLM\\...\\Run (para todos los usuarios) y las de HKCU\\...\\Run (solo este usuario), normalmente primero las de HKLM. No hay un orden garantizado entre programas, así que ninguno debe depender de otro para arrancar.',
                          values: [
                            { id: 'hkcu-run-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                            {
                              id: 'hkcu-run-onedrive',
                              name: 'OneDrive',
                              type: 'REG_SZ',
                              data: '"C:\\Users\\Alumno\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe" /background',
                              description: 'Cliente legítimo de sincronización en la nube del usuario.'
                            },
                            {
                              id: 'hkcu-run-miner',
                              name: 'CryptoMinerUpdater',
                              type: 'REG_SZ',
                              data: '"C:\\Users\\Alumno\\AppData\\Roaming\\SysTemp\\miner_svc.exe" --silent --pool=xmr',
                              description: '¡SOSPECHOSO! Ejecutable oculto en AppData\\Roaming que consume CPU al iniciar sesión este usuario. El malware suele alojarse en HKCU\\...\\Run porque no requiere permisos de Administrador para escribirse.'
                            }
                          ],
                          children: []
                        },
                        {
                          name: 'Explorer',
                          path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer',
                          hive: 'HKCU',
                          scopeLabel: 'Configuración del Explorador de Windows (explorer.exe)',
                          description: 'Personaliza el comportamiento de carpetas, barra de tareas y visualización de archivos.',
                          values: [
                            { id: 'hkcu-exp-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                          ],
                          children: [
                            {
                              name: 'Advanced',
                              path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
                              hive: 'HKCU',
                              scopeLabel: 'Opciones avanzadas de visualización de archivos y carpetas',
                              description:
                                'Controla si se muestran extensiones de archivo, archivos ocultos del sistema y detalles en el Explorador.',
                              values: [
                                { id: 'hkcu-adv-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                                {
                                  id: 'hkcu-adv-ext',
                                  name: 'HideFileExt',
                                  type: 'REG_DWORD',
                                  data: '1',
                                  description:
                                    'Oculta las extensiones de tipos de archivo conocidos. Mantenerlo en 1 es peligroso porque un troyano llamado "Factura.pdf.exe" se verá como "Factura.pdf".',
                                  allowedGuide: [
                                    { value: '0', label: 'Mostrar siempre las extensiones de archivo (Recomendado por seguridad)', impact: 'nominal' },
                                    { value: '1', label: 'Ocultar extensiones conocidas (Riesgo de camuflaje .pdf.exe)', impact: 'danger' }
                                  ]
                                },
                                {
                                  id: 'hkcu-adv-hidden',
                                  name: 'Hidden',
                                  type: 'REG_DWORD',
                                  data: '2',
                                  description: 'Controla la visibilidad de archivos y carpetas ocultos (1 = Mostrar ocultos, 2 = No mostrar).',
                                  allowedGuide: [
                                    { value: '1', label: 'Mostrar archivos y carpetas ocultos', impact: 'nominal' },
                                    { value: '2', label: 'No mostrar archivos ni carpetas ocultos', impact: 'warning' }
                                  ]
                                }
                              ],
                              children: []
                            }
                          ]
                        },
                        {
                          name: 'Policies',
                          path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies',
                          hive: 'HKCU',
                          scopeLabel: 'Directivas de restricción aplicadas al usuario actual',
                          description: 'Almacena restricciones administrativas (GPO o impuestas por malware) sobre la cuenta actual.',
                          equivalentPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies',
                          values: [
                            { id: 'hkcu-pol-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                          ],
                          children: [
                            {
                              name: 'System',
                              path: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
                              hive: 'HKCU',
                              scopeLabel: 'Restricciones de herramientas del sistema (TaskMgr, Regedit, CMD)',
                              description:
                                'Permite bloquear el Administrador de tareas o el propio Editor del Registro para el usuario actual. Muchos virus activan DisableTaskMgr=1 para impedir que el usuario mate su proceso.',
                              equivalentPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
                              values: [
                                { id: 'hkcu-polsys-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                                {
                                  id: 'hkcu-polsys-taskmgr',
                                  name: 'DisableTaskMgr',
                                  type: 'REG_DWORD',
                                  data: '1',
                                  description:
                                    'Si vale 1, bloquea el Administrador de Tareas (Ctrl+Shift+Esc) mostrando el error: "El administrador ha deshabilitado el Administrador de tareas".',
                                  allowedGuide: [
                                    { value: '0', label: 'Administrador de Tareas habilitado (Normal)', impact: 'nominal' },
                                    { value: '1', label: 'Administrador de Tareas BLOQUEADO para este usuario', impact: 'danger' }
                                  ]
                                },
                                {
                                  id: 'hkcu-polsys-reg',
                                  name: 'DisableRegistryTools',
                                  type: 'REG_DWORD',
                                  data: '0',
                                  description: 'Si se cambia a 1, bloquea el acceso a regedit.exe para el usuario actual.',
                                  allowedGuide: [
                                    { value: '0', label: 'Editor del Registro permitido', impact: 'nominal' },
                                    { value: '1', label: 'Bloquear uso de regedit.exe', impact: 'danger' }
                                  ]
                                }
                              ],
                              children: []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'HKEY_LOCAL_MACHINE',
      path: 'Equipo\\HKEY_LOCAL_MACHINE',
      hive: 'HKLM',
      scopeLabel: 'Ámbito Global del Sistema: Afecta a TODOS los usuarios, hardware y arranque',
      description:
        'Colmena maestra del sistema operativo (almacenada en C:\\Windows\\System32\\config\\SYSTEM, SOFTWARE, SAM, SECURITY). Define controladores de arranque, servicios, hardware detectado y políticas globales. Modificarla requiere permisos de Administrador.',
      values: [
        { id: 'hklm-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
      ],
      children: [
        {
          name: 'HARDWARE',
          path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE',
          hive: 'HKLM',
          scopeLabel: ' Colmena volátil en RAM: Hardware detectado en el arranque actual',
          description:
            'A diferencia de SOFTWARE o SYSTEM, la clave HARDWARE no se guarda en el disco duro: el kernel de Windows la recrea dinámicamente en memoria RAM cada vez que el equipo enciende.',
          values: [
            { id: 'hklm-hw-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'DESCRIPTION',
              path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION',
              hive: 'HKLM',
              scopeLabel: 'Descripción de componentes base detectados por ACPI/UEFI',
              description: 'Información reportada por la placa base y el procesador durante el POST.',
              values: [
                { id: 'hklm-desc-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
              ],
              children: [
                {
                  name: 'System',
                  path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System',
                  hive: 'HKLM',
                  scopeLabel: 'Datos de BIOS/UEFI y Procesador Central',
                  description: 'Consulta rápida de versión de BIOS y modelo de CPU sin instalar herramientas externas.',
                  values: [
                    { id: 'hklm-sys-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                  ],
                  children: [
                    {
                      name: 'BIOS',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\BIOS',
                      hive: 'HKLM',
                      scopeLabel: 'Identificación de la Placa Base y Firmware UEFI',
                      description: 'Valores leídos de las tablas SMBIOS durante el inicio del sistema.',
                      values: [
                        { id: 'hklm-bios-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        { id: 'hklm-bios-vendor', name: 'BIOSVendor', type: 'REG_SZ', data: 'American Megatrends Inc.', description: 'Fabricante del firmware UEFI.' },
                        { id: 'hklm-bios-ver', name: 'BIOSVersion', type: 'REG_SZ', data: 'F14c (UFES-2026)', description: 'Versión instalada de la BIOS/UEFI.' },
                        { id: 'hklm-bios-mfg', name: 'BaseBoardManufacturer', type: 'REG_SZ', data: 'Un Fantasma en el Sistema Labs', description: 'Fabricante de la placa base.' },
                        { id: 'hklm-bios-prod', name: 'SystemProductName', type: 'REG_SZ', data: 'UFES-Workstation-Pro', description: 'Nombre del modelo del equipo.' }
                      ],
                      children: []
                    },
                    {
                      name: 'CentralProcessor',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor',
                      hive: 'HKLM',
                      scopeLabel: 'Núcleos lógicos del procesador detectados',
                      description: 'Subclaves numeradas para cada hilo o núcleo del procesador.',
                      values: [
                        { id: 'hklm-cpu-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                      ],
                      children: [
                        {
                          name: '0',
                          path: 'Equipo\\HKEY_LOCAL_MACHINE\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0',
                          hive: 'HKLM',
                          scopeLabel: 'Núcleo lógico #0 de la CPU',
                          description: 'Muestra el nombre comercial de la CPU y su frecuencia base en MHz.',
                          values: [
                            { id: 'hklm-cpu0-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                            { id: 'hklm-cpu0-name', name: 'ProcessorNameString', type: 'REG_SZ', data: '13th Gen Intel(R) Core(TM) i7-13700K', description: 'Nombre comercial del procesador.' },
                            { id: 'hklm-cpu0-mhz', name: '~MHz', type: 'REG_DWORD', data: '3400', description: 'Frecuencia base del procesador en Megahercios.' }
                          ],
                          children: []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: 'SOFTWARE',
          path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE',
          hive: 'HKLM',
          scopeLabel: 'Configuración global de programas y de Windows para TODOS los usuarios',
          description:
            'Colmena almacenada en C:\\Windows\\System32\\config\\SOFTWARE. Todo cambio aquí aplica a cualquier usuario que inicie sesión en la máquina.',
          equivalentPath: 'Equipo\\HKEY_CURRENT_USER\\Software',
          values: [
            { id: 'hklm-soft-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'Microsoft',
              path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft',
              hive: 'HKLM',
              scopeLabel: 'Configuración global de componentes Microsoft',
              description: 'Ajustes de sistema operativo a nivel de máquina.',
              values: [
                { id: 'hklm-ms-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
              ],
              children: [
                {
                  name: 'Windows',
                  path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows',
                  hive: 'HKLM',
                  scopeLabel: 'Parámetros globales de Microsoft Windows',
                  description: 'Contiene CurrentVersion y directivas globales del sistema operativo.',
                  values: [
                    { id: 'hklm-win-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                  ],
                  children: [
                    {
                      name: 'CurrentVersion',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
                      hive: 'HKLM',
                      scopeLabel: 'Rutas por defecto de instalación de programas y estado global',
                      description:
                        'Define dónde se instalan por defecto las aplicaciones de 64 bits (ProgramFilesDir) y 32 bits (ProgramFilesDir (x86)) en todo el sistema.',
                      equivalentPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion',
                      values: [
                        { id: 'hklm-cv-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        {
                          id: 'hklm-cv-pf',
                          name: 'ProgramFilesDir',
                          type: 'REG_SZ',
                          data: 'C:\\Program Files',
                          description:
                            'Ruta por defecto que los instaladores (.msi / .exe) proponen al instalar software de 64 bits (es el origen de %ProgramFiles%). Ojo: Microsoft NO admite cambiarla en un equipo ya instalado; puede romper Windows Update y las actualizaciones de versión. En la práctica real se elige la ruta en cada instalador.',
                          allowedGuide: [
                            { value: 'C:\\Program Files', label: 'Ruta estándar en disco del sistema C:', impact: 'nominal' },
                            { value: 'D:\\Programas', label: 'Disco secundario D:\\Programas (no admitido por Microsoft: solo en laboratorio)', impact: 'warning' }
                          ]
                        },
                        {
                          id: 'hklm-cv-pf86',
                          name: 'ProgramFilesDir (x86)',
                          type: 'REG_SZ',
                          data: 'C:\\Program Files (x86)',
                          description: 'Ruta por defecto para aplicaciones de 32 bits (arquitectura x86 sobre Windows de 64 bits).',
                          allowedGuide: [
                            { value: 'C:\\Program Files (x86)', label: 'Ruta estándar 32 bits en disco C:', impact: 'nominal' },
                            { value: 'D:\\Programas (x86)', label: 'Disco secundario D:\\Programas (x86) (no admitido por Microsoft)', impact: 'warning' }
                          ]
                        },
                        {
                          id: 'hklm-cv-common',
                          name: 'CommonFilesDir',
                          type: 'REG_SZ',
                          data: 'C:\\Program Files\\Common Files',
                          description: 'Directorio de librerías compartidas entre aplicaciones.'
                        }
                      ],
                      children: [
                        {
                          name: 'Run',
                          path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
                          hive: 'HKLM',
                          scopeLabel: 'Inicio automático GLOBAL (Se ejecuta para TODOS los usuarios del PC)',
                          description:
                            'Los programas definidos aquí arrancan para cualquier cuenta que inicie sesión en el equipo. A diferencia de HKCU\\...\\Run, modificar esta clave exige permisos de Administrador.',
                          equivalentPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
                          precedenceNote:
                            'Se procesa ANTES que HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run. Si deshabilitas un programa aquí, dejará de abrirse para todos los usuarios del ordenador.',
                          values: [
                            { id: 'hklm-run-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                            {
                              id: 'hklm-run-sec',
                              name: 'SecurityHealth',
                              type: 'REG_EXPAND_SZ',
                              data: '%windir%\\system32\\SecurityHealthSystray.exe',
                              description: 'Icono oficial de Seguridad de Windows (Windows Defender) en la bandeja del sistema.',
                              isSystemCritical: true
                            },
                            {
                              id: 'hklm-run-audio',
                              name: 'RtkAudUService',
                              type: 'REG_SZ',
                              data: '"C:\\Windows\\System32\\RtkAudUService64.exe" -background',
                              description: 'Servicio de panel de control de audio Realtek.'
                            },
                            {
                              id: 'hklm-run-bloat',
                              name: 'TelemetryAgentGlobal',
                              type: 'REG_SZ',
                              data: '"C:\\ProgramData\\TelemetryCorp\\agent_updater.exe" --autostart-all-users',
                              description: 'Agente pesado de telemetría de terceros que ralentiza el inicio de sesión de todos los usuarios del laboratorio.'
                            }
                          ],
                          children: []
                        },
                        {
                          name: 'Policies',
                          path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies',
                          hive: 'HKLM',
                          scopeLabel: 'Directivas de seguridad globales del equipo',
                          description: 'Políticas de seguridad que aplican a toda la máquina e imponen control sobre UAC e inicio de sesión.',
                          equivalentPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies',
                          values: [
                            { id: 'hklm-pol-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                          ],
                          children: [
                            {
                              name: 'System',
                              path: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
                              hive: 'HKLM',
                              scopeLabel: 'Control de Cuentas de Usuario (UAC) y pantalla de inicio de sesión',
                              description: 'Configura el nivel de seguridad de UAC (EnableLUA) y mensajes detallados de arranque.',
                              equivalentPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
                              values: [
                                { id: 'hklm-polsys-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                                {
                                  id: 'hklm-polsys-lua',
                                  name: 'EnableLUA',
                                  type: 'REG_DWORD',
                                  data: '1',
                                  description: 'Habilita o deshabilita el Control de Cuentas de Usuario (UAC). Con 0 (tras reiniciar) las cuentas de administrador ejecutan todo con el token completo sin preguntar, los usuarios estándar no reciben la petición de elevación y las apps de la Microsoft Store dejan de abrirse.',
                                  isSystemCritical: true,
                                  allowedGuide: [
                                    { value: '1', label: 'UAC Habilitado (Protección activa contra elevación silenciosa)', impact: 'nominal' },
                                    { value: '0', label: 'UAC Desactivado (Peligro: los administradores corren todo elevado sin aviso)', impact: 'danger' }
                                  ]
                                },
                                {
                                  id: 'hklm-polsys-verbose',
                                  name: 'VerboseStatus',
                                  type: 'REG_DWORD',
                                  data: '0',
                                  description: 'Muestra mensajes detallados ("Iniciando servicio...", "Aplicando directivas...") durante el arranque y apagado.',
                                  allowedGuide: [
                                    { value: '0', label: 'Mensajes estándar ("Iniciando Windows")', impact: 'nominal' },
                                    { value: '1', label: 'Modo detallado (Verbose) activo para diagnóstico de arranque', impact: 'nominal' }
                                  ]
                                }
                              ],
                              children: []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: 'SYSTEM',
          path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM',
          hive: 'HKLM',
          scopeLabel: 'Arranque, Controladores (Drivers), Servicios y Energía del Kernel',
          description:
            'Colmena crítica para el encendido de Windows (C:\\Windows\\System32\\config\\SYSTEM). Se lee en la fase inicial del arranque antes siquiera de mostrar la pantalla de login.',
          values: [
            { id: 'hklm-system-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'CurrentControlSet',
              path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet',
              hive: 'HKLM',
              scopeLabel: 'Conjunto de control activo en el arranque actual (ControlSet001)',
              description:
                'Puntero al conjunto de configuración de hardware y servicios verificado en el arranque actual.',
              values: [
                { id: 'hklm-ccs-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
              ],
              children: [
                {
                  name: 'Control',
                  path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control',
                  hive: 'HKLM',
                  scopeLabel: 'Parámetros de control del Kernel, Energía, Sistema de Archivos y RDP',
                  description: 'Configura cómo inicia el kernel, el sistema de archivos NTFS, la energía y el Escritorio Remoto.',
                  values: [
                    { id: 'hklm-ctrl-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                  ],
                  children: [
                    {
                      name: 'Session Manager',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager',
                      hive: 'HKLM',
                      scopeLabel: 'Gestor de Sesión de Windows (smss.exe)',
                      description: 'Primer proceso en modo usuario que arranca el kernel NT.',
                      values: [
                        { id: 'hklm-sm-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                      ],
                      children: [
                        {
                          name: 'Power',
                          path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
                          hive: 'HKLM',
                          scopeLabel: 'Gestión de Energía e Inicio Rápido (Fast Startup / Hiberboot)',
                          description:
                            'Controla el modo de apagado híbrido de Windows 10/11. Con HiberbootEnabled=1, al "Apagar" el equipo el kernel no se cierra realmente, sino que se hiberna en hiberfil.sys, bloqueando particiones NTFS en sistemas Dual-Boot con Linux.',
                          values: [
                            { id: 'hklm-pwr-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                            {
                              id: 'hklm-pwr-hiberboot',
                              name: 'HiberbootEnabled',
                              type: 'REG_DWORD',
                              data: '1',
                              description:
                                'Controla el Inicio Rápido (Fast Startup). Valor 1 = Apagado híbrido activo (bloquea particiones para Linux y evita reinicios limpios del kernel). Valor 0 = Apagado completo real.',
                              allowedGuide: [
                                { value: '0', label: 'Desactivar Inicio Rápido (Apagado real limpio, ideal para Dual-Boot Linux y diagnóstico)', impact: 'nominal' },
                                { value: '1', label: 'Inicio Rápido habilitado (Hiberna el kernel al apagar; bloquea NTFS en Dual-Boot)', impact: 'warning' }
                              ]
                            }
                          ],
                          children: []
                        }
                      ]
                    },
                    {
                      name: 'Power',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Power',
                      hive: 'HKLM',
                      scopeLabel: 'Hibernación y planes de energía del equipo',
                      description:
                        'Ajustes globales de energía. No confundir con Session Manager\\Power, donde vive el Inicio Rápido.',
                      values: [
                        { id: 'hklm-cpwr-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        {
                          id: 'hklm-pwr-hibernate',
                          name: 'HibernateEnabled',
                          type: 'REG_DWORD',
                          data: '1',
                          description:
                            'Soporte general de hibernación (archivo C:\\hiberfil.sys). El Inicio Rápido depende de él: «powercfg /h off» lo pone a 0 y desactiva a la vez la hibernación y el Inicio Rápido.'
                        }
                      ],
                      children: []
                    },
                    {
                      name: 'FileSystem',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
                      hive: 'HKLM',
                      scopeLabel: 'Parámetros globales del sistema de archivos NTFS / FAT32',
                      description: 'Configura límites de longitud de ruta (MAX_PATH 260 caracteres) y rendimiento de NTFS.',
                      values: [
                        { id: 'hklm-fs-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        {
                          id: 'hklm-fs-longpaths',
                          name: 'LongPathsEnabled',
                          type: 'REG_DWORD',
                          data: '0',
                          description:
                            'Elimina la limitación histórica de 260 caracteres (MAX_PATH) en las API de archivos de Windows 10 (1607) y posteriores. Solo lo aprovechan las aplicaciones declaradas «longPathAware» (Node.js, Python, PowerShell 7…); el Explorador y muchos programas antiguos mantienen el límite, y Git necesita además core.longpaths=true.',
                          allowedGuide: [
                            { value: '0', label: 'Límite clásico de 260 caracteres activo (Puede fallar en rutas largas)', impact: 'warning' },
                            { value: '1', label: 'Rutas largas habilitadas (Hasta 32.767 caracteres en NTFS)', impact: 'nominal' }
                          ]
                        },
                        {
                          id: 'hklm-fs-lastaccess',
                          name: 'NtfsDisableLastAccessUpdate',
                          type: 'REG_DWORD',
                          data: '1',
                          description: 'Evita escrituras innecesarias en el SSD cada vez que se lee un archivo.'
                        }
                      ],
                      children: []
                    },
                    {
                      name: 'Terminal Server',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server',
                      hive: 'HKLM',
                      scopeLabel: 'Configuración de Escritorio Remoto (RDP - Puerto 3389)',
                      description: 'Controla si el equipo acepta conexiones entrantes por protocolo de Escritorio Remoto (RDP).',
                      values: [
                        { id: 'hklm-ts-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        {
                          id: 'hklm-ts-deny',
                          name: 'fDenyTSConnections',
                          type: 'REG_DWORD',
                          data: '1',
                          description:
                            'Atención a la lógica inversa del nombre ("Deny"): 1 = Denegar conexiones remotas (RDP Desactivado). 0 = Permitir conexiones remotas (RDP Activado).',
                          allowedGuide: [
                            { value: '1', label: 'Denegar conexiones RDP entrantes (Escritorio Remoto Desactivado)', impact: 'nominal' },
                            { value: '0', label: 'Permitir conexiones RDP entrantes (Escritorio Remoto Activado)', impact: 'warning' }
                          ]
                        }
                      ],
                      children: []
                    }
                  ]
                },
                {
                  name: 'Services',
                  path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services',
                  hive: 'HKLM',
                  scopeLabel: 'Servicios de Windows y Controladores del Kernel (.sys)',
                  description:
                    'Cada subclave representa un servicio en segundo plano o un driver de dispositivo. El valor DWORD "Start" define cuándo se carga: 0 (Boot), 1 (System), 2 (Automático), 3 (Manual), 4 (Deshabilitado).',
                  values: [
                    { id: 'hklm-srv-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
                  ],
                  children: [
                    {
                      name: 'USBSTOR',
                      path: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
                      hive: 'HKLM',
                      scopeLabel: 'Driver de Almacenamiento Masivo USB (Pendrives y Discos Externos)',
                      description:
                        'Controlador USBSTOR.SYS. Permite habilitar o bloquear la lectura/escritura de memorias USB sin desactivar teclados, ratones ni auriculares USB.',
                      values: [
                        { id: 'hklm-usb-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                        {
                          id: 'hklm-usb-display',
                          name: 'DisplayName',
                          type: 'REG_SZ',
                          data: 'Dispositivo de almacenamiento masivo USB',
                          description: 'Nombre descriptivo del controlador.'
                        },
                        {
                          id: 'hklm-usb-img',
                          name: 'ImagePath',
                          type: 'REG_EXPAND_SZ',
                          data: 'System32\\drivers\\USBSTOR.SYS',
                          description: 'Ruta del binario del controlador del kernel.',
                          isSystemCritical: true
                        },
                        {
                          id: 'hklm-usb-start',
                          name: 'Start',
                          type: 'REG_DWORD',
                          data: '3',
                          description:
                            'Modo de inicio del driver USBSTOR. Valor 3 = Manual (se carga al enchufar un pendrive). Valor 4 = Deshabilitado (bloquea cualquier pendrive o disco USB por seguridad).',
                          allowedGuide: [
                            { value: '3', label: '3 (Manual / Habilitado): Permite usar memorias y discos USB normalmente', impact: 'nominal' },
                            { value: '4', label: '4 (Deshabilitado): Bloquea almacenamiento USB (Política de seguridad DLP)', impact: 'warning' }
                          ]
                        },
                        {
                          id: 'hklm-usb-type',
                          name: 'Type',
                          type: 'REG_DWORD',
                          data: '1',
                          description: 'Tipo 1 = Controlador de dispositivo en modo Kernel.',
                          isSystemCritical: true
                        }
                      ],
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'HKEY_USERS',
      path: 'Equipo\\HKEY_USERS',
      hive: 'HKU',
      scopeLabel: 'Todos los perfiles de usuario cargados y perfil .DEFAULT (Pantalla de Login)',
      description:
        'Contiene la subclave .DEFAULT (utilizada por la pantalla de inicio de sesión antes de que entre ningún usuario) y las subclaves identificadas por el SID (Security Identifier) de cada usuario activo.',
      values: [
        { id: 'hku-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
      ],
      children: [
        {
          name: '.DEFAULT',
          path: 'Equipo\\HKEY_USERS\\.DEFAULT',
          hive: 'HKU',
          scopeLabel: 'Perfil de la cuenta SYSTEM / Pantalla de inicio de sesión (Winlogon)',
          description: 'Ojo con la trampa habitual: .DEFAULT NO es la plantilla para nuevos usuarios, sino el perfil que usa la pantalla de inicio de sesión antes de que te autentiques.',
          values: [
            { id: 'hku-defp-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'Control Panel',
              path: 'Equipo\\HKEY_USERS\\.DEFAULT\\Control Panel',
              hive: 'HKU',
              scopeLabel: 'Panel de control durante la pantalla de login',
              description: 'Ajustes de teclado y ratón antes de iniciar sesión.',
              values: [
                { id: 'hku-cp-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
              ],
              children: [
                {
                  name: 'Keyboard',
                  path: 'Equipo\\HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard',
                  hive: 'HKU',
                  scopeLabel: 'Estado del teclado (Bloq Num) en la pantalla de contraseña',
                  description: 'Permite activar la tecla Bloq Num automáticamente antes de escribir la contraseña de usuario.',
                  values: [
                    { id: 'hku-kbd-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                    {
                      id: 'hku-kbd-numlock',
                      name: 'InitialKeyboardIndicators',
                      type: 'REG_SZ',
                      data: '0',
                      description: 'Estado de Bloq Num al encender el PC en la pantalla de login (0 = Apagado, 2 = Bloq Num Activado).',
                      allowedGuide: [
                        { value: '0', label: 'Bloq Num desactivado en la pantalla de login', impact: 'warning' },
                        { value: '2', label: 'Bloq Num ACTIVADO automáticamente al arrancar', impact: 'nominal' }
                      ]
                    }
                  ],
                  children: []
                }
              ]
            }
          ]
        }
      ]
    },
    {
      name: 'HKEY_CURRENT_CONFIG',
      path: 'Equipo\\HKEY_CURRENT_CONFIG',
      hive: 'HKCC',
      scopeLabel: 'Perfil de hardware actual (Enlace simbólico a HKLM\\SYSTEM\\CurrentControlSet\\Hardware Profiles\\Current)',
      description:
        'No es una colmena real en disco, sino un puntero directo al perfil de hardware en curso (resolución de pantalla, fuentes e impresora predeterminada).',
      values: [
        { id: 'hkcc-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
      ],
      children: [
        {
          name: 'Software',
          path: 'Equipo\\HKEY_CURRENT_CONFIG\\Software',
          hive: 'HKCC',
          scopeLabel: 'Ajustes de software ligados al perfil de pantalla actual',
          description: 'Configuración de escalado de fuentes (DPI).',
          values: [
            { id: 'hkcc-soft-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true }
          ],
          children: [
            {
              name: 'Fonts',
              path: 'Equipo\\HKEY_CURRENT_CONFIG\\Software\\Fonts',
              hive: 'HKCC',
              scopeLabel: 'Resolución lógica de fuentes (Puntos por pulgada - DPI)',
              description: 'Indica los píxeles lógicos por pulgada del monitor activo.',
              values: [
                { id: 'hkcc-fnt-def', name: '(Predeterminado)', type: 'REG_SZ', data: '', isDefault: true },
                {
                  id: 'hkcc-fnt-dpi',
                  name: 'LogPixels',
                  type: 'REG_DWORD',
                  data: '96',
                  description: 'Escala de pantalla: 96 = 100% (Estándar), 120 = 125%, 144 = 150%.'
                }
              ],
              children: []
            }
          ]
        }
      ]
    }
  ]
};

export const DIDACTIC_MISSIONS: MissionScenario[] = [
  {
    id: 'mission-fast-startup',
    number: '01',
    title: 'Desactivar el Inicio Rápido (Fast Startup) para Dual-Boot',
    category: 'Arranque y Energía',
    difficulty: 'Básico',
    hiveFocus: 'HKLM',
    symptom:
      'Has instalado Ubuntu junto a Windows en Dual-Boot, pero al apagar Windows e iniciar Linux no puedes montar la partición NTFS porque aparece "hibernada/bloqueada". Además, el contador de tiempo activo de la CPU nunca vuelve a cero al apagar.',
    didacticExplanation:
      'El Inicio Rápido (Hiberboot) afecta al apagado del kernel de todo el sistema operativo antes de que ningún usuario inicie sesión. Por eso reside en HKEY_LOCAL_MACHINE\\SYSTEM y no en HKEY_CURRENT_USER.',
    targetPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power',
    targetValueName: 'HiberbootEnabled',
    hint: 'Navega a HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power, haz doble clic en HiberbootEnabled y cambia su información del valor a 0.',
    expectedSummary: 'HiberbootEnabled = 0 (REG_DWORD)',
    checkCompleted: (root) => !isFastStartupActive(root)
  },
  {
    id: 'mission-startup-malware',
    number: '02',
    title: 'Neutralizar Malware en el Inicio de Sesión del Usuario (HKCU vs HKLM)',
    category: 'Seguridad y Malware',
    difficulty: 'Básico',
    hiveFocus: 'HKLM vs HKCU',
    symptom:
      'Cuando el usuario actual inicia sesión, el ventilador de la CPU se pone al 100% por un proceso llamado "miner_svc.exe" alojado en AppData\\Roaming. Sin embargo, cuando entra otro usuario del equipo no ocurre. Elimina la entrada maliciosa sin borrar Windows Defender (SecurityHealth) en HKLM.',
    didacticExplanation:
      'El malware sin permisos de Administrador no puede escribir en HKLM\\...\\Run (global), así que se inyecta en HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run (exclusivo del usuario actual).',
    targetPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    targetValueName: 'CryptoMinerUpdater',
    hint: 'Ve a HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run y elimina el valor "CryptoMinerUpdater". Cambiarle el nombre no sirve: Windows ejecuta la ruta, no el nombre. Conserva SecurityHealth intacto en HKLM.',
    expectedSummary: 'Eliminar CryptoMinerUpdater en HKCU\\...\\Run',
    checkCompleted: (root) => {
      const defenderVal = getValueData(
        root,
        'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
        'SecurityHealth'
      );
      return (
        !isMinerActive(root) &&
        Boolean(defenderVal?.toLowerCase().includes('securityhealthsystray.exe'))
      );
    }
  },
  {
    id: 'mission-block-usb',
    number: '03',
    title: 'Bloquear Memorias USB (USBSTOR) por Seguridad',
    category: 'Hardware y Periféricos',
    difficulty: 'Intermedio',
    hiveFocus: 'HKLM',
    symptom:
      'En los equipos del aula de informática se requiere impedir que cualquier usuario conecte pendrives o discos duros USB para evitar infecciones y copia de exámenes, pero permitiendo que el teclado y el ratón USB sigan funcionando.',
    didacticExplanation:
      'Los controladores del kernel (.sys) son globales para toda la máquina y se configuran en HKLM\\SYSTEM\\CurrentControlSet\\Services. En los servicios de Windows, el valor Start = 3 significa Manual (activo bajo demanda) y Start = 4 significa Deshabilitado.',
    targetPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
    targetValueName: 'Start',
    hint: 'En HKLM\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR, modifica el valor DWORD "Start" de 3 a 4.',
    expectedSummary: 'Start = 4 (Deshabilitado) en el servicio USBSTOR',
    checkCompleted: (root) =>
      getValueData(
        root,
        'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR',
        'Start'
      ) === '4'
  },
  {
    id: 'mission-install-path',
    number: '04',
    title: 'Redirigir la Ruta por Defecto de Instalación al Disco D:',
    category: 'Almacenamiento y Rutas',
    difficulty: 'Intermedio',
    hiveFocus: 'HKLM',
    symptom:
      'El disco C: es un SSD de poca capacidad casi lleno y el equipo cuenta con un segundo disco rápido en D:. Configura Windows para que todos los instaladores de 64 bits propongan instalar en "D:\\Programas" por defecto.',
    didacticExplanation:
      'La ubicación de archivos de programa es compartida por todo el sistema operativo, por lo que se almacena en HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion bajo el valor ProgramFilesDir. Aviso: Microsoft no admite cambiarla en un Windows real (puede romper Windows Update); aquí se practica para localizar la clave, pero en producción se elige la ruta en cada instalador.',
    targetPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
    targetValueName: 'ProgramFilesDir',
    hint: 'Abre HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion y cambia el valor de cadena "ProgramFilesDir" a D:\\Programas',
    expectedSummary: 'ProgramFilesDir = D:\\Programas',
    checkCompleted: (root) => {
      const val = getValueData(
        root,
        'Equipo\\HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion',
        'ProgramFilesDir'
      );
      const normalized = val?.trim().replace(/\\+$/, '').toLowerCase();
      return normalized === 'd:\\programas' || normalized === 'd:\\program files';
    }
  },
  {
    id: 'mission-unlock-taskmgr',
    number: '05',
    title: 'Desbloquear el Administrador de Tareas Restringido por Directiva',
    category: 'Directivas de Usuario',
    difficulty: 'Básico',
    hiveFocus: 'HKCU',
    symptom:
      'Al pulsar Ctrl + Shift + Esc aparece un aviso diciendo: "El administrador ha deshabilitado el Administrador de tareas". Restaura el acceso al Administrador de Tareas para el usuario actual.',
    didacticExplanation:
      'Las directivas que restringen herramientas de la interfaz de un usuario concreto se alojan en HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System mediante el valor DisableTaskMgr.',
    targetPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
    targetValueName: 'DisableTaskMgr',
    hint: 'Ve a HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System y cambia "DisableTaskMgr" a 0 (o elimina el valor).',
    expectedSummary: 'DisableTaskMgr = 0 (o eliminado)',
    checkCompleted: (root) => {
      const val = getValueData(
        root,
        'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System',
        'DisableTaskMgr'
      );
      return val === '0' || val === undefined;
    }
  },
  {
    id: 'mission-show-extensions',
    number: '06',
    title: 'Mostrar Extensiones de Archivo para Prevenir Engaños (.pdf.exe)',
    category: 'Directivas de Usuario',
    difficulty: 'Básico',
    hiveFocus: 'HKCU',
    symptom:
      'Los usuarios del departamento han recibido correos con archivos llamados "Nomina_Mayo.pdf.exe", pero el Explorador de Windows oculta el ".exe" final mostrando solo "Nomina_Mayo.pdf". Configura el Explorador del usuario para mostrar siempre las extensiones.',
    didacticExplanation:
      'Las preferencias visuales del Explorador pertenecen a la sesión de cada usuario y se guardan en HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced.',
    targetPath: 'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
    targetValueName: 'HideFileExt',
    hint: 'En HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced, cambia "HideFileExt" de 1 a 0.',
    expectedSummary: 'HideFileExt = 0 (No ocultar extensiones)',
    checkCompleted: (root) =>
      getValueData(
        root,
        'Equipo\\HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced',
        'HideFileExt'
      ) === '0'
  },
  {
    id: 'mission-long-paths-numlock',
    number: '07',
    title: 'Habilitar Rutas Largas NTFS (>260 caracteres) y Bloq Num en Login',
    category: 'Almacenamiento y Rutas',
    difficulty: 'Avanzado',
    hiveFocus: 'HKLM + HKU',
    symptom:
      'Al clonar repositorios profundos o restaurar copias de seguridad aparece el error de ruta demasiado larga (MAX_PATH 260 caracteres). Además, se pide que el teclado numérico (Bloq Num) esté activo antes de iniciar sesión.',
    didacticExplanation:
      'El límite del sistema de archivos NTFS se controla globalmente en HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem (LongPathsEnabled = 1), mientras que el estado del teclado antes del login reside en HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard (InitialKeyboardIndicators = 2).',
    targetPath: 'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
    targetValueName: 'LongPathsEnabled',
    hint: 'Establece LongPathsEnabled = 1 en HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem y cambia InitialKeyboardIndicators = 2 en HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard.',
    expectedSummary: 'LongPathsEnabled = 1 + InitialKeyboardIndicators = 2',
    checkCompleted: (root) => {
      const longPaths = getValueData(
        root,
        'Equipo\\HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem',
        'LongPathsEnabled'
      );
      const numLock = getValueData(
        root,
        'Equipo\\HKEY_USERS\\.DEFAULT\\Control Panel\\Keyboard',
        'InitialKeyboardIndicators'
      );
      return longPaths === '1' && numLock === '2';
    }
  }
];
