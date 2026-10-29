import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StudentProfile } from './types';
import { ProgressService } from '../progress/ProgressService';
import { LocalProgressRepository } from '../progress/LocalProgressRepository';
import { StudentContext, StudentContextValue } from './StudentContextInstance';
import { offlineOutbox } from '../services/OfflineOutboxQueue';

export function StudentProvider({ children }: { children: React.ReactNode }) {
  const [activeStudent, setActiveStudent] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const progressService = useMemo(() => new ProgressService(new LocalProgressRepository()), []);

  // The active student comes only from the server student session. Old local-only profiles
  // may still be in localStorage; they are left alone but never become active.
  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/student/session');
      if (res.ok) {
        const data = await res.json();
        if (data?.student) {
          setActiveStudent({
            id: data.student.id,
            name: data.student.name,
            avatar: data.student.avatar,
            classId: data.student.classId,
            schoolId: data.student.schoolId,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          });
          offlineOutbox.setSessionStudent(data.student.id);
          return;
        }
      }
      setActiveStudent(null);
    } catch {
      // Offline or server unreachable: no verified session
      setActiveStudent(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    offlineOutbox.setSessionStudent(null);
    setActiveStudent(null);
  }, [activeStudent]);

  const setActiveStudentFromServer = useCallback((student: StudentProfile) => {
    setActiveStudent(student);
    offlineOutbox.setSessionStudent(student.id);
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

  const clearActiveStudentProgress = useCallback(async () => {
    if (activeStudent?.id) {
      await progressService.clearProgress(activeStudent.id);
    }
  }, [activeStudent, progressService]);

  const value = useMemo<StudentContextValue>(
    () => ({
      activeStudent,
      activeStudentId: activeStudent?.id ?? null,
      isLoading,
      clearActiveStudentProgress,
      logout,
      setActiveStudentFromServer,
    }),
    [activeStudent, isLoading, clearActiveStudentProgress, logout, setActiveStudentFromServer]
  );

  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}
