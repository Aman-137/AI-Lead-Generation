import crypto from "crypto";

// =============================================
// AES-256-GCM Encryption for stored credentials
// =============================================
// Requires TOKEN_ENCRYPTION_KEY env var (32-byte hex = 64 hex chars)
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// KEY ROTATION SUPPORT:
// - TOKEN_ENCRYPTION_KEY: Current key used for NEW encryptions
// - TOKEN_ENCRYPTION_KEY_PREV: Previous key(s), comma-separated, for decrypting old data
// - Encrypted values are prefixed with "v1:" to identify the key version
// - To rotate: move current key to _PREV, set new TOKEN_ENCRYPTION_KEY
// - Old data decrypts with previous key; new data uses new key
// - Run a migration script to re-encrypt all stored tokens with the new key

const KEY_VERSION = "v1";

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(key, "hex");
}

// Get all decryption keys (current + previous) for key rotation support
function getDecryptionKeys(): Buffer[] {
  const keys: Buffer[] = [getEncryptionKey()];
  const prevKeys = process.env.TOKEN_ENCRYPTION_KEY_PREV;
  if (prevKeys) {
    for (const k of prevKeys.split(",")) {
      const trimmed = k.trim();
      if (trimmed.length === 64) {
        keys.push(Buffer.from(trimmed, "hex"));
      }
    }
  }
  return keys;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  // Format: v1:iv:authTag:encryptedData (all hex, versioned for rotation)
  return `${KEY_VERSION}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText.includes(":")) {
    throw new Error("Invalid encrypted token format. Please reconnect your account.");
  }

  const parts = encryptedText.split(":");

  // Handle versioned format: v1:iv:authTag:encrypted
  // Handle legacy format: iv:authTag:encrypted (no version prefix)
  let iv: Buffer;
  let authTag: Buffer;
  let encrypted: string;

  if (parts[0] === KEY_VERSION && parts.length === 4) {
    // Versioned format
    iv = Buffer.from(parts[1], "hex");
    authTag = Buffer.from(parts[2], "hex");
    encrypted = parts[3];
  } else if (parts.length === 3) {
    // Legacy format (pre-rotation)
    iv = Buffer.from(parts[0], "hex");
    authTag = Buffer.from(parts[1], "hex");
    encrypted = parts[2];
  } else {
    throw new Error("Invalid encrypted token format. Please reconnect your account.");
  }

  // Try all available keys (current + previous) for decryption
  const keys = getDecryptionKeys();
  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      // Wrong key — try next one
      continue;
    }
  }

  throw new Error("Unable to decrypt token. Key may have been rotated without migration. Please reconnect your account.");
}

// Utility: check if a token needs re-encryption (uses old format or old key)
export function needsReEncryption(encryptedText: string): boolean {
  // If it doesn't start with current version, it needs re-encryption
  return !encryptedText.startsWith(`${KEY_VERSION}:`);
}

// Utility: re-encrypt a token with the current key
export function reEncrypt(encryptedText: string): string {
  const plaintext = decrypt(encryptedText);
  return encrypt(plaintext);
}
