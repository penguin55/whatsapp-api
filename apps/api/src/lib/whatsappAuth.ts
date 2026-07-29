/**
 * Sequelize Auth State Adapter for Baileys
 * 
 * This is the core of the system - it replaces file-based auth storage
 * with PostgreSQL database storage via Sequelize.
 * 
 * How it works:
 * 1. On init: Load all auth keys from database for the session
 * 2. On saveCreds: Upsert credentials to database
 * 3. On get: Retrieve specific keys from memory cache
 * 4. On set: Save keys to database and update cache
 */

import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap,
  SignalDataSet,
  initAuthCreds,
  proto,
} from '@whiskeysockets/baileys';
import { AuthKey } from '../models/AuthKey';
import { BufferJSON } from './bufferJson';

// Key types that Baileys stores (for reference)
// 'creds', 'pre-key', 'session', 'sender-key', 'sender-key-memory',
// 'app-state-sync-key', 'app-state-sync-version'

/**
 * Create auth state adapter using Sequelize
 * 
 * @param sessionId - Unique session identifier
 * @returns Promise containing state object and saveCreds function
 */
export async function useSequelizeAuthState(
  sessionId: string
): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
  deleteSession: () => Promise<void>;
}> {
  // In-memory cache for faster access
  const cache = new Map<string, unknown>();

  /**
   * Generate a unique key for storage
   */
  const getKey = (type: string, id?: string): string => {
    return id ? `${type}-${id}` : type;
  };

  /**
   * Write data to database
   */
  const writeData = async (type: string, data: unknown, id?: string): Promise<void> => {
    const key = getKey(type, id);
    const serialized = BufferJSON.stringify(data);

    try {
      // Upsert: Create or update
      await AuthKey.upsert({
        session_id: sessionId,
        type: key,
        value: serialized,
      });

      // Update cache
      cache.set(key, data);
    } catch (error) {
      console.error(`[Auth] Error writing ${key}:`, error);
      throw error;
    }
  };

  /**
   * Read data from database or cache
   */
  const readData = async <T>(type: string, id?: string): Promise<T | null> => {
    const key = getKey(type, id);

    // Check cache first
    if (cache.has(key)) {
      return cache.get(key) as T;
    }

    try {
      const record = await AuthKey.findOne({
        where: {
          session_id: sessionId,
          type: key,
        },
      });

      if (!record) {
        return null;
      }

      const data = BufferJSON.parse<T>(record.value);
      cache.set(key, data);
      return data;
    } catch (error) {
      console.error(`[Auth] Error reading ${key}:`, error);
      return null;
    }
  };

  /**
   * Remove data from database
   */
  const removeData = async (type: string, id?: string): Promise<void> => {
    const key = getKey(type, id);

    try {
      await AuthKey.destroy({
        where: {
          session_id: sessionId,
          type: key,
        },
      });

      cache.delete(key);
    } catch (error) {
      console.error(`[Auth] Error removing ${key}:`, error);
    }
  };

  /**
   * Initialize: Load existing credentials from database
   */
  const initState = async (): Promise<AuthenticationCreds> => {
    // Try to load existing credentials
    const existingCreds = await readData<AuthenticationCreds>('creds');

    if (existingCreds) {
      console.log(`[Auth] Loaded existing credentials for session: ${sessionId}`);
      return existingCreds;
    }

    // Create new credentials
    console.log(`[Auth] Creating new credentials for session: ${sessionId}`);
    const newCreds = initAuthCreds();
    await writeData('creds', newCreds);
    return newCreds;
  };

  /**
   * Preload all auth keys for this session into cache
   */
  const preloadCache = async (): Promise<void> => {
    try {
      const allKeys = await AuthKey.findAll({
        where: { session_id: sessionId },
      });

      for (const record of allKeys) {
        const data = BufferJSON.parse(record.value);
        cache.set(record.type, data);
      }

      console.log(`[Auth] Preloaded ${allKeys.length} auth keys for session: ${sessionId}`);
    } catch (error) {
      console.error('[Auth] Error preloading cache:', error);
    }
  };

  // Preload cache and initialize credentials
  await preloadCache();
  const creds = await initState();

  return {
    state: {
      creds,
      keys: {
        /**
         * Get keys from storage
         */
        get: async <T extends keyof SignalDataTypeMap>(
          type: T,
          ids: string[]
        ): Promise<{ [id: string]: SignalDataTypeMap[T] }> => {
          const result: { [id: string]: SignalDataTypeMap[T] } = {};

          for (const id of ids) {
            const data = await readData<SignalDataTypeMap[T]>(type, id);
            if (data) {
              // Handle special case for app-state-sync-key
              if (type === 'app-state-sync-key' && typeof data === 'object') {
                result[id] = proto.Message.AppStateSyncKeyData.fromObject(
                  data as Record<string, unknown>
                ) as unknown as SignalDataTypeMap[T];
              } else {
                result[id] = data;
              }
            }
          }

          return result;
        },

        /**
         * Set keys to storage
         */
        set: async (data: SignalDataSet): Promise<void> => {
          const tasks: Promise<void>[] = [];

          for (const category of Object.keys(data) as (keyof SignalDataSet)[]) {
            const entries = data[category];
            if (!entries) continue;

            for (const [id, value] of Object.entries(entries)) {
              if (value) {
                tasks.push(writeData(category, value, id));
              } else {
                tasks.push(removeData(category, id));
              }
            }
          }

          await Promise.all(tasks);
        },
      },
    },

    /**
     * Save credentials to database
     * Called by Baileys when credentials are updated
     */
    saveCreds: async (): Promise<void> => {
      await writeData('creds', creds);
    },

    /**
     * Delete all session data from database
     */
    deleteSession: async (): Promise<void> => {
      try {
        const count = await AuthKey.destroy({
          where: { session_id: sessionId },
        });
        cache.clear();
        console.log(`[Auth] Deleted ${count} auth keys for session: ${sessionId}`);
      } catch (error) {
        console.error('[Auth] Error deleting session:', error);
        throw error;
      }
    },
  };
}

export default useSequelizeAuthState;
