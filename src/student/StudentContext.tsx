import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentProfile } from './types';
import { StudentService } from './StudentService';
import { LocalStudentRepository } from './LocalStudentRepository';
import { ProgressService } from '../progress/ProgressService';
import { LocalProgressRepository } from '../progress/LocalProgressRepository';
import { StudentContext, StudentContextValue } from './StudentContextInstance';
import { offlineOutbox } from '../services/OfflineOutboxQueue';

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
      // 1. Check server student session first
      try {
        const res = await fetch('/api/student/session');
        if (res.ok) {
          const data = await res.json();
          if (data?.student) {
            const serverProfile: StudentProfile = {
              id: data.student.id,
              name: data.student.name,
              avatar: data.student.avatar,
              classId: data.student.classId,
              schoolId: data.student.schoolId,
              createdAt: new Date().toISOString(),
              lastActiveAt: new Date().toISOString(),
            };
            setActiveStudent(serverProfile);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Network or offline, fallback to local storage
      }

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

  const logout = useCallback(async () => {
    const studentId =
      activeStudent?.id ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('sa.activeStudentId.v1') : null);

    try {
      await fetch('/api/student/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    }

    // Shared desktop hygiene: remove only student session keys.
    // NEVER call localStorage.clear() or sessionStorage.clear().
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('sa.activeStudentId.v1');
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (studentId ? key.startsWith(`sa.student.${studentId}`) : key.startsWith('sa.student.'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      }
      if (typeof sessionStorage !== 'undefined') {
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (studentId ? key.startsWith(`sa.student.${studentId}`) : key.startsWith('sa.student.'))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
      }
    } catch {
      // Ignore storage errors
    }
    setActiveStudent(null);
    setStudents([]);
  }, [activeStudent]);

  const setActiveStudentFromServer = useCallback((student: StudentProfile) => {
    setActiveStudent(student);
    offlineOutbox.flush(student.id).catch(() => {});
  }, []);

  // Auto-logout after 5 idle minutes on shared desktops
  useEffect(() => {
    if (!activeStudent) return;
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    let timeoutId = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT_MS);

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [activeStudent, logout]);

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
      logout,
      setActiveStudentFromServer,
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
      logout,
      setActiveStudentFromServer,
    ]
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}
