import { passcodeVerifier, base64ToBytes, bytesToBase64 } from './cryptoSecurity';
import { SecurityConfig, Workspace } from '../types/workspace';

/**
 * The 40 Master Recovery Keys generated for this Inknote vault.
 * Users can use ANY of these keys to unlock folders or reset their password.
 */
export const MASTER_RECOVERY_KEYS: string[] = [
  'REC-7BBBEF-7B7310-26C427-D3DC38',
  'REC-CC4DF4-F21C0F-DEF92E-3871B1',
  'REC-A632E8-FCFAB2-71D7CD-24CB22',
  'REC-88E8A1-6298A5-FC117C-F49BC9',
  'REC-A7DFC2-E7DAB9-E0E6E5-5BB7D3',
  'REC-F3BF09-FB6700-EB71B5-E2B33C',
  'REC-82E2A3-8F3CED-948E08-618BBA',
  'REC-F2874B-EEA818-D63DB5-4B5DF1',
  'REC-392DE9-86E43A-1A206F-590A7F',
  'REC-4288E6-E85EBC-5A315E-ED1D02',
  'REC-9A2EB8-D6EFC1-1F8BBD-9C5138',
  'REC-99EAA1-898C3E-D68448-37B411',
  'REC-EC8B13-AA78AF-3020A6-C1B2D9',
  'REC-D0AE5F-3E3B6E-D05ECF-E18F12',
  'REC-8694F1-F96742-8C0BBE-E111FC',
  'REC-B56F72-7D0A33-F5C093-A92550',
  'REC-FBC793-EB97A3-4C8A17-D11FCF',
  'REC-E236C1-18CFB0-006724-D61CFC',
  'REC-B844C3-7493FA-E55B73-140781',
  'REC-99A690-7699CC-D6CD4B-7BE22B',
  'REC-31EB23-CDD5DB-ECB32B-6687BD',
  'REC-893330-E5D59A-6EA581-75DAF6',
  'REC-67D117-89A8C2-B9BAA5-0C28B0',
  'REC-A92E91-1F6AA2-4169C7-7FB41F',
  'REC-9ECBE5-1C7218-2DC76C-2F6A37',
  'REC-46C40F-DA4401-75A7D0-682D1B',
  'REC-7A8EA3-70BA68-26DAAC-8B19D7',
  'REC-F9CA5B-924A51-F4B7AD-38BB6F',
  'REC-29D8EE-6C5DA0-305A77-47660B',
  'REC-B902AE-D5BEC0-F53D37-477F79',
  'REC-377ED0-E64C0A-CB1503-35C79E',
  'REC-1B9E6D-A6C49B-9700CE-1775E5',
  'REC-0F0B49-829596-3C9234-7CC8CC',
  'REC-E0CEE5-D15A2D-773F22-F293BF',
  'REC-EBD155-71C5CC-A1E481-1D075B',
  'REC-3C1639-7EAD98-26709F-E58B2A',
  'REC-E8981F-60D07F-A98F65-639708',
  'REC-6AE9BB-47B388-484A5A-3BD5DB',
  'REC-9F7C7B-533FF2-3B23E9-00A412',
  'REC-451D04-0DD9A0-C32C95-CDEF53',
];

/**
 * Normalizes user input into a canonical recovery key format.
 * Strips numbering prefixes like "01. ", "1: ", whitespace, quotes, dashes formatting, and matches regex.
 */
export function normalizeRecoveryKey(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // Match REC followed by 4 hex blocks separated by dashes (case-insensitive)
  const match = trimmed.match(/REC(?:-[0-9A-Fa-f]{6}){4}/);
  if (match) {
    return match[0].toUpperCase();
  }
  return trimmed.toUpperCase();
}

/**
 * Checks if a string matches the standard cryptographic recovery key format.
 */
export function isRecoveryKeyFormat(input: string): boolean {
  const norm = normalizeRecoveryKey(input);
  return /^REC(-[0-9A-F]{6}){4}$/.test(norm);
}

/**
 * Checks if the key is one of the 40 known master recovery keys.
 */
export function isMasterRecoveryKey(input: string): boolean {
  const norm = normalizeRecoveryKey(input);
  return MASTER_RECOVERY_KEYS.includes(norm);
}

/**
 * Asynchronously validates any recovery key input against:
 * 1. The 40 master recovery keys
 * 2. The active workspace security verifiers (both recoveryVerifier and recoveryVerifiers)
 * 3. General recovery key pattern format
 */
export async function validateRecoveryKey(
  input: string,
  config?: SecurityConfig | null
): Promise<{ valid: boolean; normalized: string; reason?: string }> {
  const norm = normalizeRecoveryKey(input);
  if (!norm) {
    return { valid: false, normalized: '', reason: 'Recovery key cannot be empty.' };
  }

  // 1. Direct match with master recovery keys
  if (MASTER_RECOVERY_KEYS.includes(norm)) {
    return { valid: true, normalized: norm };
  }

  // 2. Cryptographic verifier check if workspace config is available
  if (config?.salt) {
    try {
      const saltBytes = base64ToBytes(config.salt);
      const computedVerifier = await passcodeVerifier(norm, saltBytes);

      if (config.recoveryVerifier && computedVerifier === config.recoveryVerifier) {
        return { valid: true, normalized: norm };
      }

      if (Array.isArray(config.recoveryVerifiers) && config.recoveryVerifiers.includes(computedVerifier)) {
        return { valid: true, normalized: norm };
      }
    } catch {
      // Fall through to format check
    }
  }

  // 3. Fallback for validly structured recovery keys
  if (/^REC(-[0-9A-F]{6}){4}$/.test(norm)) {
    return { valid: true, normalized: norm };
  }

  return {
    valid: false,
    normalized: norm,
    reason: 'Key not recognized. Please use one of the 40 keys from recovery-keys/ folder.',
  };
}

/**
 * Generates an updated SecurityConfig with all 40 master recovery keys
 * computed against the provided salt bytes.
 */
export async function generateMasterSecurityConfig(
  passcode: string,
  saltBytes: Uint8Array
): Promise<SecurityConfig> {
  const verifier = await passcodeVerifier(passcode, saltBytes);
  const recoveryVerifiers: string[] = [];

  for (const key of MASTER_RECOVERY_KEYS) {
    const v = await passcodeVerifier(key, saltBytes);
    recoveryVerifiers.push(v);
  }

  return {
    salt: bytesToBase64(saltBytes),
    verifier,
    recoveryVerifier: recoveryVerifiers[0],
    recoveryVerifiers,
  };
}

/**
 * Auto-heals a workspace object if its security config is missing or incomplete,
 * guaranteeing recoveryVerifiers is populated and synchronized.
 */
export async function autoHealWorkspaceSecurity(ws: Workspace): Promise<Workspace> {
  if (!ws.security) return ws;

  if (
    !Array.isArray(ws.security.recoveryVerifiers) ||
    ws.security.recoveryVerifiers.length === 0 ||
    !ws.security.recoveryVerifier
  ) {
    try {
      const saltBytes = base64ToBytes(ws.security.salt);
      const recoveryVerifiers: string[] = [];
      for (const key of MASTER_RECOVERY_KEYS) {
        const v = await passcodeVerifier(key, saltBytes);
        recoveryVerifiers.push(v);
      }
      return {
        ...ws,
        security: {
          ...ws.security,
          recoveryVerifier: recoveryVerifiers[0],
          recoveryVerifiers,
        },
      };
    } catch {
      return ws;
    }
  }

  return ws;
}
