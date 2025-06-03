import { knex } from '../../database/connection';
import { logger } from '../../utils/logger';

/**
 * Get a system setting value
 * @param key Setting key
 * @returns Setting value or null if not found
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const setting = await knex('system_settings')
      .where({ key })
      .select('value')
      .first();

    return setting?.value || null;
  } catch (error) {
    logger.error('Error getting system setting', {
      error,
      key
    });
    return null;
  }
}

/**
 * Set a system setting value
 * @param key Setting key
 * @param value Setting value
 */
export async function setSystemSetting(key: string, value: string): Promise<void> {
  try {
    await knex('system_settings')
      .insert({ key, value })
      .onConflict('key')
      .merge();
  } catch (error) {
    logger.error('Error setting system setting', {
      error,
      key,
      value
    });
    throw error;
  }
} 