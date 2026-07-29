import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
} from 'sequelize-typescript';

/**
 * AuthKey Model
 * Stores WhatsApp authentication credentials (replacement for auth_info folder)
 * 
 * IMPORTANT: The 'value' column uses LONGTEXT because Baileys credentials
 * can be very large (especially for multi-device). Using TEXT or STRING
 * will cause data truncation and decryption errors.
 * 
 * NOTE: We use session_id as a string reference (not a FK) because
 * AuthKey needs to reference Session.session_id (string), not Session.id (int)
 */
@Table({
  tableName: 'auth_keys',
  timestamps: true,
  indexes: [
    {
      name: 'auth_keys_session_id_idx',
      fields: ['session_id'],
    },
    {
      name: 'auth_keys_session_type_uidx',
      fields: ['session_id', 'type'],
      unique: true,
    },
  ],
})
export class AuthKey extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    comment: 'Session identifier this key belongs to',
  })
  declare session_id: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    comment: 'Type of auth data (creds, app-state-sync-key-*, etc)',
  })
  declare type: string;

  /**
   * PostgreSQL TEXT stores the serialized authentication payload.
   * Baileys credentials can be very large, especially:
   * - creds.json: Contains keys, identities, etc
   * - app-state-sync-key-*: Can be megabytes in size
   * 
   * Using TEXT (65KB limit) will truncate data and cause:
   * - "Bad MAC" errors
   * - Decryption failures  
   * - Session corruption
   */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
    comment: 'JSON-serialized auth data with Buffer support',
  })
  declare value: string;

  /**
   * Get parsed value (with Buffer restoration)
   * Note: Use BufferJSON.reviver when parsing
   */
  getParsedValue<T>(): T {
    return JSON.parse(this.value) as T;
  }
}

export default AuthKey;
