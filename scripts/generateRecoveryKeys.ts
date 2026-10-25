import fs from 'fs';
import path from 'path';
import { generateRecoveryKey, passcodeVerifier, base64ToBytes } from '../src/utils/cryptoSecurity';

async function main() {
  const wsPath = path.resolve('inknote-vault/workspace.json');
  const ws = JSON.parse(fs.readFileSync(wsPath, 'utf8'));
  const salt = ws.security?.salt || 'BmaNPgBxFkKAmfIQ+/Zq3A==';
  const saltBytes = base64ToBytes(salt);

  const keys: Array<{ index: number; key: string; verifier: string }> = [];
  const verifiers: string[] = [];

  for (let i = 1; i <= 40; i++) {
    const key = generateRecoveryKey();
    const verifier = await passcodeVerifier(key, saltBytes);
    keys.push({ index: i, key, verifier });
    verifiers.push(verifier);
  }

  // Update workspace.json
  if (!ws.security) {
    ws.security = { salt, verifier: '' };
  }
  ws.security.recoveryVerifier = verifiers[0];
  ws.security.recoveryVerifiers = verifiers;
  fs.writeFileSync(wsPath, JSON.stringify(ws, null, 2), 'utf8');

  // Create recovery-keys folder
  const recDir = path.resolve('recovery-keys');
  if (!fs.existsSync(recDir)) {
    fs.mkdirSync(recDir, { recursive: true });
  }

  const textLines = [
    '========================================================================',
    'INKNOTE EMERGENCY RECOVERY KEYS',
    '========================================================================',
    `Generated: ${new Date().toISOString()}`,
    'Count: 40 Emergency Recovery Keys',
    'Target Folder: Journal & Private Notes',
    '',
    'HOW TO USE:',
    '1. Open Inknote in your browser or desktop app.',
    '2. Click on "Journal" or "Open Today\'s Journal".',
    '3. On the password modal, click: "Lost passkey? Use recovery key".',
    '4. Copy and paste ANY ONE of the 40 keys below into the input box.',
    '5. Press "Unlock" -> Today\'s journal unlocks immediately!',
    '========================================================================',
    '',
  ];

  for (const k of keys) {
    textLines.push(`${String(k.index).padStart(2, '0')}. ${k.key}`);
  }

  fs.writeFileSync(path.join(recDir, 'recovery_keys.txt'), textLines.join('\n'), 'utf8');

  // Also create a formatted README.md
  const mdContent = `# Inknote Recovery Keys

> **Keep these keys safe.** Any one of these 40 emergency recovery keys can be used to unlock your private Journal and notes if you forgot your password.

## How to Unlock Today's Journal
1. Click on **Journal** or **Today's Journal** in Inknote.
2. In the password prompt modal, click **"Lost passkey? Use recovery key"**.
3. Copy and paste any one of the 40 keys below into the field.
4. Click **Unlock**. Today's journal note will immediately open!

## 40 Valid Recovery Keys

| # | Recovery Key |
|---|---|
${keys.map((k) => `| ${k.index} | \`${k.key}\` |`).join('\n')}

---

## How to Change or Reset Your Password Once Unlocked
1. Once unlocked, click the three dots (\`...\`) next to the **Journal** folder in the left sidebar.
2. Click **Remove passkey protection**.
3. Click **Protect with passkey** to set a brand-new password of your choice!
`;

  fs.writeFileSync(path.join(recDir, 'README.md'), mdContent, 'utf8');

  // Also copy to vault folder so it is visible in disk vault
  const vaultRecDir = path.resolve('inknote-vault/Recovery-Keys');
  if (!fs.existsSync(vaultRecDir)) {
    fs.mkdirSync(vaultRecDir, { recursive: true });
  }
  fs.writeFileSync(path.join(vaultRecDir, 'recovery_keys.txt'), textLines.join('\n'), 'utf8');

  console.log('SUCCESS: Generated 40 recovery keys, updated workspace.json, and created recovery-keys folder.');
}

main().catch(console.error);
