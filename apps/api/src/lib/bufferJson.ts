/**
 * BufferJSON Utility
 * 
 * Baileys stores credentials using Buffer objects. When saving to database,
 * we need to serialize Buffers to JSON-safe format and restore them when reading.
 * 
 * CRITICAL: Without proper Buffer handling, you will get:
 * - "Bad MAC" decryption errors
 * - "invalid signature" errors
 * - Session corruption
 */

type BufferLike = {
  type: 'Buffer';
  data: number[];
};

/**
 * BufferJSON replacer and reviver for JSON.stringify/parse
 * Converts Buffer objects to/from JSON-safe format
 */
export const BufferJSON = {
  /**
   * Replacer function for JSON.stringify
   * Converts Buffer and Uint8Array to { type: 'Buffer', data: [...] }
   */
  replacer: (_key: string, value: unknown): unknown => {
    if (value instanceof Buffer) {
      return {
        type: 'Buffer',
        data: Array.from(value),
      };
    }

    if (value instanceof Uint8Array) {
      return {
        type: 'Buffer',
        data: Array.from(value),
      };
    }

    // Handle ArrayBuffer
    if (value instanceof ArrayBuffer) {
      return {
        type: 'Buffer',
        data: Array.from(new Uint8Array(value)),
      };
    }

    return value;
  },

  /**
   * Reviver function for JSON.parse
   * Restores { type: 'Buffer', data: [...] } back to Buffer
   */
  reviver: (_key: string, value: unknown): unknown => {
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in value &&
      'data' in value
    ) {
      const obj = value as BufferLike;
      if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
      }
    }
    return value;
  },

  /**
   * Stringify with Buffer support
   */
  stringify: (data: unknown): string => {
    return JSON.stringify(data, BufferJSON.replacer);
  },

  /**
   * Parse with Buffer restoration
   */
  parse: <T>(str: string): T => {
    return JSON.parse(str, BufferJSON.reviver) as T;
  },
};

export default BufferJSON;
