export type UserRole = 'ADMIN' | 'MANAGER' | 'VIEWER';

export interface OptimizerService {
  run(input: { vehicles: number; stops: number }): Promise<{
    status: 'STUB' | 'DONE';
    message: string;
  }>;
}
