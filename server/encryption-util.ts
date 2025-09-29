// crypto-utils.ts
import crypto from "crypto";

const algorithm = "aes-256-gcm";
const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes (64 hex chars)

// Encrypts a string (e.g. JSON.stringify(obj)) and returns a JSON string
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // return as JSON string for DB storage
  return JSON.stringify({
    iv: iv.toString("hex"),
    content: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  });
}

// Takes a JSON string from DB, parses it, decrypts, and returns the original text
export function decrypt(encryptedString: string): string {
  const encrypted = JSON.parse(encryptedString); // { iv, content, tag }

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(encrypted.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.content, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8"); // plain JSON string, call JSON.parse outside if needed
}