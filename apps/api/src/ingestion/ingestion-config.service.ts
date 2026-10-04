import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface SourceQuotaConfig {
  source: string;
  label: string;
  quota: number;
  default: number;
  min: number;
  max: number;
  unit: string;
  category: 'JOB' | 'COURSE';
}

export type IngestionQuotasMap = Record<string, SourceQuotaConfig>;

const DEFAULT_QUOTAS: IngestionQuotasMap = {
  JSEARCH: {
    source: 'JSEARCH',
    label: 'JSearch (Google Jobs RapidAPI)',
    quota: 15,
    default: 15,
    min: 5,
    max: 50,
    unit: 'ตำแหน่ง',
    category: 'JOB',
  },
  JOBSDB: {
    source: 'JOBSDB',
    label: 'JobsDB Thailand (SEEK Asia)',
    quota: 30,
    default: 30,
    min: 10,
    max: 60,
    unit: 'ตำแหน่ง',
    category: 'JOB',
  },
  JOBTHAI: {
    source: 'JOBTHAI',
    label: 'JobThai',
    quota: 25,
    default: 25,
    min: 10,
    max: 50,
    unit: 'ตำแหน่ง',
    category: 'JOB',
  },
  REMOTIVE: {
    source: 'REMOTIVE',
    label: 'Remotive Global Remote Tech',
    quota: 20,
    default: 20,
    min: 5,
    max: 50,
    unit: 'ตำแหน่ง',
    category: 'JOB',
  },
  BLOGNONE: {
    source: 'BLOGNONE',
    label: 'Blognone Jobs (Thai Tech)',
    quota: 15,
    default: 15,
    min: 5,
    max: 30,
    unit: 'ตำแหน่ง',
    category: 'JOB',
  },
  YOUTUBE: {
    source: 'YOUTUBE',
    label: 'YouTube Courses (Live oEmbed)',
    quota: 10,
    default: 10,
    min: 3,
    max: 25,
    unit: 'คอร์ส',
    category: 'COURSE',
  },
  UDEMY: {
    source: 'UDEMY',
    label: 'Udemy Courses (Verified Industry)',
    quota: 10,
    default: 10,
    min: 5,
    max: 30,
    unit: 'คอร์ส',
    category: 'COURSE',
  },
};

@Injectable()
export class IngestionConfigService {
  private readonly logger = new Logger(IngestionConfigService.name);
  private readonly configFilePath: string;
  private memoryQuotas: IngestionQuotasMap;

  constructor() {
    const configDirectory = process.env.INGESTION_CONFIG_DIR?.trim()
      || path.resolve(__dirname, '../../config');
    this.configFilePath = path.resolve(configDirectory, 'ingestion-quotas.json');
    this.memoryQuotas = this.loadPersistentQuotas();
  }

  private getClonedDefaults(): IngestionQuotasMap {
    return JSON.parse(JSON.stringify(DEFAULT_QUOTAS));
  }

  private loadPersistentQuotas(): IngestionQuotasMap {
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Merge with defaults in case new sources are added
        const merged: IngestionQuotasMap = this.getClonedDefaults();
        for (const [key, val] of Object.entries(parsed)) {
          if (merged[key] && typeof (val as any).quota === 'number') {
            merged[key] = {
              ...merged[key],
              quota: Math.max(merged[key].min, Math.min(merged[key].max, (val as any).quota)),
            };
          }
        }
        return merged;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to read persistent quotas from ${this.configFilePath}: ${err.message}. Using defaults.`);
    }

    return this.getClonedDefaults();
  }

  private savePersistentQuotas(quotas: IngestionQuotasMap) {
    try {
      const dir = path.dirname(this.configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configFilePath, JSON.stringify(quotas, null, 2), 'utf-8');
      this.logger.log(`Saved ingestion quotas to ${this.configFilePath}`);
    } catch (err: any) {
      this.logger.error(`Failed to save persistent quotas to ${this.configFilePath}: ${err.message}`);
    }
  }

  /**
   * Get all quota settings
   */
  getQuotas(): IngestionQuotasMap {
    return JSON.parse(JSON.stringify(this.memoryQuotas));
  }

  /**
   * Get quota number for a specific source
   */
  getQuotaForSource(source: string): number {
    const cleanKey = source.replace(/^COURSE_/, '').toUpperCase();
    const config = this.memoryQuotas[cleanKey];
    return config ? config.quota : 20;
  }

  /**
   * Update one or multiple source quotas
   */
  updateQuotas(updates: Record<string, number>): IngestionQuotasMap {
    for (const [key, newQuota] of Object.entries(updates)) {
      const cleanKey = key.replace(/^COURSE_/, '').toUpperCase();
      if (this.memoryQuotas[cleanKey] && typeof newQuota === 'number') {
        const min = this.memoryQuotas[cleanKey].min;
        const max = this.memoryQuotas[cleanKey].max;
        this.memoryQuotas[cleanKey] = {
          ...this.memoryQuotas[cleanKey],
          quota: Math.max(min, Math.min(max, Math.round(newQuota))),
        };
      }
    }

    this.savePersistentQuotas(this.memoryQuotas);
    return this.getQuotas();
  }

  /**
   * Reset all quotas to system defaults
   */
  resetDefaults(): IngestionQuotasMap {
    this.memoryQuotas = this.getClonedDefaults();
    this.savePersistentQuotas(this.memoryQuotas);
    this.logger.log('Reset ingestion quotas to defaults');
    return this.getQuotas();
  }
}
