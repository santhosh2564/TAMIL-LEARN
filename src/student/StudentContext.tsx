import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentProfile } from './types';
import { StudentService } from './StudentService';
import { LocalStudentRepository } from './LocalStudentRepository';
import { ProgressService } from '../progress/ProgressService';
import { LocalProgressRepository } from '../progress/LocalProgressRepository';
import { StudentContext, StudentContextValue } from './StudentContextInstance';

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const progressService = useMemo(() => new ProgressService(new LocalProgressRepository()), []);
  const studentService = useMemo(
    () =>
      new StudentService(new LocalStudentRepository(), {
        onStudentDeleted: async (studentId: string) => {
          await progressService.deleteStudentData(studentId);
        },
      }),
    [progressService]
  );

  const loadData = useCallback(async () => {
    try {
      const allStudents = await studentService.listStudents();
      setStudents(allStudents);

      const currentActive = await studentService.getActiveStudent();
      setActiveStudent(currentActive);
    } catch {
      // Local storage read error; fall back safely
      setStudents([]);
      setActiveStudent(null);
    } finally {
      setIsLoading(false);
    }
  }, [studentService]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectStudent = useCallback(
    async (id: string) => {
      const student = await studentService.setActiveStudent(id);
      setActiveStudent(student);
      const allStudents = await studentService.listStudents();
      setStudents(allStudents);
    },
    [studentService]
  );

  const createAndSelectStudent = useCallback(
    async (name: string) => {
      const newStudent = await studentService.createStudent(name);
      setActiveStudent(newStudent);
      const allStudents = await studentService.listStudents();
      setStudents(allStudents);
      return newStudent;
    },
    [studentService]
  );

  const clearActiveStudent = useCallback(async () => {
    await studentService.clearActiveStudent();
    setActiveStudent(null);
  }, [studentService]);

  const deleteStudent = useCallback(
    async (id: string) => {
      // Delete progress & attempts, then profile
      await studentService.deleteStudent(id);
      if (activeStudent?.id === id) {
        setActiveStudent(null);
      }
      const allStudents = await studentService.listStudents();
      setStudents(allStudents);
    },
    [studentService, activeStudent]
  );

  const clearActiveStudentProgress = useCallback(async () => {
    if (activeStudent?.id) {
      await progressService.clearProgress(activeStudent.id);
    }
  }, [activeStudent, progressService]);

  const clearAllStudentsData = useCallback(async () => {
    await progressService.clearProgress(); // clears all progress and attempts
    await studentService.clearAllStudents();
    setActiveStudent(null);
    setStudents([]);
  }, [studentService, progressService]);

  const value = useMemo<StudentContextValue>(
    () => ({
      activeStudent,
      activeStudentId: activeStudent?.id ?? null,
      students,
      isLoading,
      selectStudent,
      createAndSelectStudent,
      clearActiveStudent,
      deleteStudent,
      clearActiveStudentProgress,
      clearAllStudentsData,
      refreshStudents: loadData,
    }),
    [
      activeStudent,
      students,
      isLoading,
      selectStudent,
      createAndSelectStudent,
      clearActiveStudent,
      deleteStudent,
      clearActiveStudentProgress,
      clearAllStudentsData,
      loadData,
    ]
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}
