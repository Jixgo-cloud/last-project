'use client';

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@smartcareer/shared';
import { useLanguage } from '@/lib/use-language';
import { applicationStatusLabel } from '@/lib/application-status';
import {
  Bell,
  CheckCircle2,
  Calendar,
  Code2,
  Award,
  AlertCircle,
  Clock,
  CheckCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: any;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const applicationListPath = user?.role === UserRole.COMPANY
    ? '/company/applications'
    : '/applications';
  const applicationListLabel = user?.role === UserRole.COMPANY
    ? 'ดูรายชื่อผู้สมัครทั้งหมด'
    : 'ดูการสมัครงานทั้งหมด';
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiRequest<NotificationItem[]>('/notifications?limit=25');
      setNotifications(data || []);
      const unread = (data || []).filter((n) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (err) {
      // Fail silently for background polling
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Poll every 15 seconds for real-time notification experience
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        bellRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }

    if (link) {
      setOpen(false);
      router.push(link);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await apiRequest('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'เมื่อสักครู่';
      if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
      if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;
      if (diffDay === 1) return 'เมื่อวานนี้';
      if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
      return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getStatusIcon = (notif: NotificationItem) => {
    const status = notif.metadata?.newStatus;
    switch (status) {
      case 'INTERVIEW':
        return (
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200">
            <Calendar className="w-4 h-4" />
          </div>
        );
      case 'TECHNICAL_TEST':
        return (
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200">
            <Code2 className="w-4 h-4" />
          </div>
        );
      case 'OFFER':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
            <Award className="w-4 h-4" />
          </div>
        );
      case 'ACCEPTED':
        return (
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-200">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'REJECTED':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
            <AlertCircle className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-[#e8eaff] text-[#4f46e5] flex items-center justify-center shrink-0 border border-[#dce0ff]">
            <Sparkles className="w-4 h-4" />
          </div>
        );
    }
  };

  if (!user) return null;

  return (
    <div className="static sm:relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        id="btn-notification-bell"
        ref={bellRef}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            fetchNotifications();
          }
        }}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border transition ${
          open
            ? 'border-indigo-300 bg-indigo-50 text-[#4f46e5]'
            : 'border-slate-200 bg-white text-slate-600 hover:text-[#4f46e5] hover:bg-slate-50 hover:border-slate-300'
        }`}
        aria-label="การแจ้งเตือน"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div className="absolute inset-x-4 top-[calc(100%+8px)] z-50 flex max-h-[calc(100dvh-10rem)] sm:max-h-[calc(100dvh-6rem)] flex-col w-auto sm:inset-x-auto sm:right-0 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-[#fbfcfe]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8eaff] text-[#4f46e5]">
                  ใหม่ {unreadCount} รายการ
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={loading}
                className="text-[11px] font-semibold text-[#4f46e5] hover:text-[#4338ca] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                อ่านแล้วทั้งหมด
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="min-h-0 max-h-[380px] overflow-y-auto overscroll-contain divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">ไม่มีการแจ้งเตือน</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  เมื่อมีการอัปเดตสถานะหรือข่าวสาร จะแสดงที่นี่
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.link)}
                  className={`p-3.5 transition flex items-start gap-3 cursor-pointer group ${
                    notif.isRead
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                  }`}
                >
                  {getStatusIcon(notif)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          notif.isRead ? 'font-semibold text-slate-800' : 'font-bold text-[#111827]'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>

                    {notif.metadata?.newStatus && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                          {language === 'EN' ? 'Status' : 'สถานะ'}: {applicationStatusLabel(notif.metadata.newStatus, language)}
                        </span>
                        {notif.metadata?.companyName && (
                          <span className="text-[10px] text-slate-400 truncate">
                            · {notif.metadata.companyName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!notif.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#4f46e5] shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 p-2 border-t border-slate-100 bg-[#fbfcfe] text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(applicationListPath);
              }}
              className="w-full py-1.5 text-[11px] font-bold text-[#4f46e5] hover:bg-[#e8eaff] rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
            >
              {applicationListLabel} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
