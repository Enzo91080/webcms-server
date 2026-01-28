import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Process = sequelize.define('Process', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  parentProcessId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Processes',
      key: 'id',
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  orderInParent: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  objectives: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  stakeholders: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  referenceDocuments: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  sipoc: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  logigramme: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'processes',
  timestamps: true,
  underscored: false,
});

// Self-referential association
Process.hasMany(Process, {
  as: 'children',
  foreignKey: 'parentProcessId',
  onDelete: 'SET NULL',
});

Process.belongsTo(Process, {
  as: 'parent',
  foreignKey: 'parentProcessId',
});

export default Process;
