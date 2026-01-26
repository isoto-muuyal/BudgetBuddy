import crypto from 'crypto';

// Get encryption key from environment or use a default (should be in secrets)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'budgetwise-default-key-32chars!!'; // Must be 32 bytes
const ALGORITHM = 'aes-256-cbc';

// Ensure key is exactly 32 bytes
const getKey = (): Buffer => {
  const key = ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0');
  return Buffer.from(key, 'utf-8');
};

export function encrypt(text: string): string {
  if (!text) return text;
  
  try {
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data (IV is needed for decryption)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      // Data is not encrypted, return as is
      return encryptedText;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, data might not be encrypted or the key changed.
    // Return original without throwing to avoid breaking requests.
    return encryptedText;
  }
}
