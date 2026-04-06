import { DataTypes } from 'sequelize';

export function defineSchedulerTask(sequelize) {
  return sequelize.define('SchedulerTask', {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    name: DataTypes.STRING(80),
    cron_exp: DataTypes.STRING(80),
    payload: {
      type: DataTypes.TEXT,
      get() {
        const v = this.getDataValue('payload');
        try { return v ? JSON.parse(v) : {}; } catch { return {}; }
      },
      set(v) {
        this.setDataValue('payload', v ? JSON.stringify(v) : null);
      },
    },
    timezone: DataTypes.STRING(64),
    description: DataTypes.STRING(200),
    enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'idle',
    },
    last_run_at: DataTypes.DATE,
    last_error: DataTypes.TEXT,
    tries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  }, {
    tableName: 'scheduler_tasks',
    timestamps: false,
  });
}
