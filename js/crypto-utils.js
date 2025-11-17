// Cryptography utilities for secure password storage
// Uses Web Crypto API for client-side encryption

const CryptoUtil = {
  // Generate a deterministic key from a password using PBKDF2
  async deriveKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encrypt a password for storage
  async encryptPassword(password) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const key = await this.deriveKeyFromPassword(password, salt);
      
      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(password)
      );

      // Combine salt, iv, and encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      // Return as base64 for storage
      return this.arrayToBase64(combined);
    } catch (e) {
      console.error('Encryption failed:', e);
      return null;
    }
  },

  // Verify a password against encrypted data
  async verifyPassword(password, encryptedData) {
    try {
      const combined = this.base64ToArray(encryptedData);
      
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);

      const key = await this.deriveKeyFromPassword(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      const dec = new TextDecoder();
      const decryptedPassword = dec.decode(decrypted);

      return decryptedPassword === password;
    } catch (e) {
      console.error('Decryption failed:', e);
      return false;
    }
  },

  // Hash data for integrity checking (non-reversible, for sensitive data)
  async hashData(data) {
    try {
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(data));
      return this.arrayToBase64(new Uint8Array(hashBuffer));
    } catch (e) {
      console.error('Hashing failed:', e);
      return null;
    }
  },

  // Encrypt sensitive strings (like API keys, tokens)
  async encryptString(data, masterPassword) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const key = await this.deriveKeyFromPassword(masterPassword, salt);

      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(data)
      );

      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      return this.arrayToBase64(combined);
    } catch (e) {
      console.error('String encryption failed:', e);
      return null;
    }
  },

  // Decrypt sensitive strings
  async decryptString(encryptedData, masterPassword) {
    try {
      const combined = this.base64ToArray(encryptedData);

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encrypted = combined.slice(28);

      const key = await this.deriveKeyFromPassword(masterPassword, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (e) {
      console.error('String decryption failed:', e);
      return null;
    }
  },

  // Utility: Convert Uint8Array to Base64
  arrayToBase64(arr) {
    const binary = String.fromCharCode.apply(null, arr);
    return btoa(binary);
  },

  // Utility: Convert Base64 to Uint8Array
  base64ToArray(b64) {
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      arr[i] = binary.charCodeAt(i);
    }
    return arr;
  },

  // Generate a random token for sessions/API keys
  generateToken(length = 32) {
    const arr = crypto.getRandomValues(new Uint8Array(length));
    return this.arrayToBase64(arr);
  }
};
