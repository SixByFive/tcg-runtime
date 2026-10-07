// packages/database/src/sequalize.js 

import { Sequelize } from "sequelize";
import { getSharedConfig } from '@sbf/config';

let sequelizeInstance = null;

/**
 * Creates a singleton Sequelize instance for the shared MySQL database.
 * We keep this central so every service uses the same bootstrap pattern.
 */
export function getSequelize() {
    if (sequelizeInstance) {
        return sequelizeInstance; 
    }

    const config = getSharedConfig(); 

    sequelizeInstance = new Sequelize(
        config.db.name,
        config.db.user,
        config.db.pass,
        {
            host: config.db.host,
            port: config.db.port,
            dialect: 'mysql',
            logging: false,
            // Force utf8mb4 everywhere. Without this, mysql2's default charset
            // interprets 4-byte UTF-8 (em-dash, é, emoji, etc.) as latin1 on
            // read, producing mojibake like "Café" → "Café" in API responses
            // even though the DB column stores correct UTF-8 bytes.
            dialectOptions: {
                charset: 'utf8mb4',
            },
            define: {
                freezeTableName: true,
                charset: 'utf8mb4',
                collate: 'utf8mb4_unicode_ci',
            },
        }
    );
    return sequelizeInstance;
}