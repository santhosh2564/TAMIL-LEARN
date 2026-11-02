import { Activity } from '../types';
import { ProgressRepository } from './ProgressRepository';
import { LocalProgressRepository, PROGRESS_STORAGE_KEY_V2 } from './LocalProgressRepository';
import { LocalContentRepository } from '../repositories/implementations/LocalContentRepository';

export interface TamilDayProgress {
  module: number;
  day: number;
  totalActivities: number;
  completedActivities: number;
  correctActivities: number;
  accuracy: number;
  percent: number;
  isCompleted: boolean;
}

export interface TamilModuleProgress {
  module: number;
  totalActivities: number;
  completedActivities: number;
  completedDays: number;
  percent: number;
  isCompleted: boolean;
  accuracy: number;
}

export interface TamilCurriculumProgress {
  totalActivities: number;
  completedActivities: number;
  modulesCompleted: number;
  percent: number;
  accuracy: number;
  recommendedSession: {
    module: number;
    day: number;
    label: string;
  };
}

export class TamilProgressService {
  private repository: ProgressRepository;
  private contentRepo: LocalContentRepository;
  private tamilActivities: Activity[] | null = null;
  private activitiesByModuleAndDay = new Map<string, Activity[]>();

  constructor(
    repository: ProgressRepository = new LocalProgressRepository(PROGRESS_STORAGE_KEY_V2),
    contentRepo: LocalContentRepository = new LocalContentRepository()
  ) {
    this.repository = repository;
    this.contentRepo = contentRepo;
  }

  private async ensureIndexed(): Promise<void> {
    if (this.tamilActivities) return;

    this.tamilActivities = await this.contentRepo.getActivities({ subject: 'Tamil' });

    for (const act of this.tamilActivities) {
      if (act.module && act.day) {
        const key = `${act.module}_${act.day}`;
        const list = this.activitiesByModuleAndDay.get(key) || [];
        list.push(act);
        this.activitiesByModuleAndDay.set(key, list);
      }
    }
  }

  async getDayProgress(moduleNumber: number, dayNumber: number, studentId?: string): Promise<TamilDayProgress> {
    await this.ensureIndexed();

    const key = `${moduleNumber}_${dayNumber}`;
    const activities = this.activitiesByModuleAndDay.get(key) || [];
    const total = activities.length;

    if (total === 0) {
      return {
        module: moduleNumber,
        day: dayNumber,
        totalActivities: 0,
        completedActivities: 0,
        correctActivities: 0,
        accuracy: 0,
        percent: 0,
        isCompleted: false,
      };
    }

    let completed = 0;
    let correct = 0;

    for (const act of activities) {
      const prog = await this.repository.getActivityProgress(act.id, studentId);
      if (prog && prog.completed) {
        completed++;
        if (prog.correct) {
          correct++;
        }
      }
    }

    const accuracy = completed > 0 ? Math.round((correct / completed) * 100) : 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      module: moduleNumber,
      day: dayNumber,
      totalActivities: total,
      completedActivities: completed,
      correctActivities: correct,
      accuracy,
      percent,
      isCompleted: completed >= total && total > 0,
    };
  }

  async getModuleProgress(moduleNumber: number, studentId?: string): Promise<TamilModuleProgress> {
    await this.ensureIndexed();

    let totalActivities = 0;
    let completedActivities = 0;
    let completedDays = 0;
    let correctActivities = 0;

    for (let day = 1; day <= 5; day++) {
      const dayProg = await this.getDayProgress(moduleNumber, day, studentId);
      totalActivities += dayProg.totalActivities;
      completedActivities += dayProg.completedActivities;
      correctActivities += dayProg.correctActivities;
      if (dayProg.isCompleted) {
        completedDays++;
      }
    }

    const percent = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
    const accuracy = completedActivities > 0 ? Math.round((correctActivities / completedActivities) * 100) : 0;

    return {
      module: moduleNumber,
      totalActivities,
      completedActivities,
      completedDays,
      percent,
      isCompleted: completedDays === 5,
      accuracy,
    };
  }

  async getAllModulesProgress(studentId?: string): Promise<TamilModuleProgress[]> {
    const list: TamilModuleProgress[] = [];
    for (let m = 1; m <= 8; m++) {
      list.push(await this.getModuleProgress(m, studentId));
    }
    return list;
  }

  async getCurriculumProgress(studentId?: string): Promise<TamilCurriculumProgress> {
    await this.ensureIndexed();

    const allMods = await this.getAllModulesProgress(studentId);
    let totalActivities = 0;
    let completedActivities = 0;
    let modulesCompleted = 0;

    for (const m of allMods) {
      totalActivities += m.totalActivities;
      completedActivities += m.completedActivities;
      if (m.isCompleted) {
        modulesCompleted++;
      }
    }

    const percent = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;

    // Find recommended session: earliest incomplete module and day
    let recMod = 1;
    let recDay = 1;
    let found = false;

    for (let m = 1; m <= 8 && !found; m++) {
      for (let d = 1; d <= 5; d++) {
        const dp = await this.getDayProgress(m, d, studentId);
        if (!dp.isCompleted) {
          recMod = m;
          recDay = d;
          found = true;
          break;
        }
      }
    }

    return {
      totalActivities,
      completedActivities,
      modulesCompleted,
      percent,
      accuracy: 0,
      recommendedSession: {
        module: recMod,
        day: recDay,
        label: `தொகுதி ${recMod} · நாள் ${recDay}`,
      },
    };
  }
}
