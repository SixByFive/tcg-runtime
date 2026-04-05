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
            derfine: {
                freezeTableName: true, 
            }
        }
    ); 
    return sequelizeInstance;
}