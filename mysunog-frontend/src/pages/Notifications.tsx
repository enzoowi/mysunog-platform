import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import EmergencyRouteMap from '../components/EmergencyRouteMap';

type NotificationItem = {
    id: number;
    title: string;
    message: string;
    isRead: boolean;
    type: 'ai_alert' | 'system' | 'general' | 'alert';
    link: string | null;
    createdAt: string;
};

type FilterType = 'all' | 'unread' | 'ai_alert';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MODERATE: '#eab308',
    LOW: '#22c55e',
};

function getPriorityFromTitle(title: string): string {
    for (const priority of ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']) {
        if (title.toUpperCase().includes(priority)) return priority;
    }
    return '';
}

function isDetectionAlert(notification: NotificationItem): boolean {
    return (
        notification.type === 'alert' &&
        (notification.title.includes('AI Detection Alert') ||
            notification.title.includes('AI Video Detection Alert'))
    );
}

/** Very simple markdown → HTML for the AI response sections */
function renderMarkdown(md: string): string {
    return md
        .replace(/## (.*)/g, '<h3 style="margin:18px 0 8px;font-size:16px;font-weight:700;color:#111827;">$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^\d+\.\s+(.*)/gm, '<li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.6;">$1</li>')
        .replace(/^[-•]\s+(.*)/gm, '<li style="margin:4px 0;font-size:14px;color:#374151;line-height:1.6;">$1</li>')
        .replace(/\n\n/g, '<br/>')
        .replace(/\n/g, '<br/>');
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const navigate = useNavigate();

    // AI Advice modal state
    const [adviceModalOpen, setAdviceModalOpen] = useState(false);
    const [adviceLoading, setAdviceLoading] = useState(false);
    const [adviceContent, setAdviceContent] = useState('');
    const [adviceNotification, setAdviceNotification] = useState<NotificationItem | null>(null);
    const [adviceCoords, setAdviceCoords] = useState<{ lat: number; lng: number } | null>(null);

    async function fetchNotifications() {
        try {
            setLoading(true);
            const res = await api.get('/notifications/my');
            setNotifications(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function markAsRead(id: number, e: React.MouseEvent) {
        e.stopPropagation();
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
            );
        } catch (error) {
            console.error(error);
        }
    }

    async function markAllAsRead() {
        try {
            await api.patch('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (error) {
            console.error(error);
        }
    }

    async function clearAll() {
        if (!window.confirm('Delete all notifications? This cannot be undone.')) return;
        try {
            await api.delete('/notifications/clear-all');
            setNotifications([]);
        } catch (error) {
            console.error(error);
        }
    }

    function handleCardClick(notification: NotificationItem) {
        if (!notification.isRead) {
            api.patch(`/notifications/${notification.id}/read`).catch(() => {});
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
            );
        }
        if (notification.link) {
            navigate(notification.link);
        }
    }

    async function handleMoreInfo(notification: NotificationItem, e: React.MouseEvent) {
        e.stopPropagation();
        setAdviceNotification(notification);
        setAdviceContent('');
        setAdviceCoords(null);
        setAdviceModalOpen(true);
        setAdviceLoading(true);
        try {
            const res = await api.get(`/notifications/${notification.id}/ai-advice`);
            setAdviceContent(res.data.advice);
            if (res.data.latitude && res.data.longitude) {
                setAdviceCoords({ lat: res.data.latitude, lng: res.data.longitude });
            }
        } catch (error) {
            console.error(error);
            setAdviceContent('Failed to load AI advice. Please try again.');
        } finally {
            setAdviceLoading(false);
        }
    }

    useEffect(() => {
        fetchNotifications();
    }, []);

    const filtered = notifications.filter((n) => {
        if (filter === 'unread') return !n.isRead;
        if (filter === 'ai_alert') return n.type === 'ai_alert' || n.type === 'alert';
        return true;
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                        🔔 Notifications
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {unreadCount > 0 && (
                        <button
                            id="notifications-mark-all-read"
                            onClick={markAllAsRead}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: '1px solid #e5e7eb',
                                color: '#374151',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Mark all as read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            id="notifications-clear-all"
                            onClick={clearAll}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
                {[
                    { key: 'all', label: `All (${notifications.length})` },
                    { key: 'unread', label: `Unread (${unreadCount})` },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        id={`notifications-filter-${key}`}
                        onClick={() => setFilter(key as FilterType)}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            background: 'transparent',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: filter === key ? '#ea580c' : '#6b7280',
                            borderBottom: filter === key ? '2px solid #ea580c' : '2px solid transparent',
                            marginBottom: '-1px',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Notification list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{
                        width: '36px', height: '36px', margin: '0 auto 12px',
                        border: '3px solid #f97316', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading notifications...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>No notifications in this category.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filtered.map((notification) => {
                        const isAiAlert = notification.type === 'ai_alert' || notification.type === 'alert';
                        const priority = isAiAlert ? getPriorityFromTitle(notification.title) : '';
                        const priorityColor = PRIORITY_COLORS[priority] || '#f97316';
                        const showMoreInfo = isDetectionAlert(notification);

                        return (
                            <div
                                key={notification.id}
                                id={`notification-card-${notification.id}`}
                                onClick={() => handleCardClick(notification)}
                                style={{
                                    display: 'flex',
                                    gap: '14px',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: `1px solid ${!notification.isRead ? (isAiAlert ? '#fecaca' : '#fed7aa') : '#e5e7eb'}`,
                                    background: !notification.isRead ? (isAiAlert ? '#fff5f5' : '#fff7ed') : '#fff',
                                    cursor: notification.link ? 'pointer' : 'default',
                                    transition: 'box-shadow 0.15s, transform 0.1s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                                onMouseEnter={(e) => {
                                    if (notification.link) {
                                        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Left accent bar for unread */}
                                {!notification.isRead && (
                                    <div style={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0,
                                        width: '4px',
                                        background: isAiAlert ? priorityColor : '#f97316',
                                        borderRadius: '12px 0 0 12px',
                                    }} />
                                )}

                                {/* Icon */}
                                <div style={{
                                    flexShrink: 0,
                                    width: '40px', height: '40px',
                                    borderRadius: '10px',
                                    background: isAiAlert
                                        ? `${priorityColor}20`
                                        : '#fff7ed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '18px',
                                }}>
                                    {isAiAlert ? '🔥' : '🔔'}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: notification.isRead ? 500 : 700,
                                            color: '#111827',
                                            lineHeight: '1.3',
                                        }}>
                                            {notification.title}
                                        </p>
                                        {isAiAlert && priority && (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '9999px',
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                letterSpacing: '0.05em',
                                                background: `${priorityColor}20`,
                                                color: priorityColor,
                                                textTransform: 'uppercase',
                                            }}>
                                                {priority}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{
                                        margin: '4px 0 0',
                                        fontSize: '13px',
                                        color: '#6b7280',
                                        lineHeight: '1.5',
                                    }}>
                                        {notification.message}
                                    </p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                            {timeAgo(notification.createdAt)}
                                        </span>
                                        {notification.link && (
                                            <span style={{ fontSize: '12px', color: '#ea580c', fontWeight: 600 }}>
                                                View → 
                                            </span>
                                        )}
                                        {showMoreInfo && (
                                            <button
                                                onClick={(e) => handleMoreInfo(notification, e)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #dc2626',
                                                    background: 'linear-gradient(135deg, #dc2626, #ea580c)',
                                                    color: '#fff',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    letterSpacing: '0.02em',
                                                    transition: 'opacity 0.15s',
                                                }}
                                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
                                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                                            >
                                                🤖 AI Advice
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Mark as read button */}
                                {!notification.isRead && (
                                    <button
                                        id={`notification-mark-read-${notification.id}`}
                                        onClick={(e) => markAsRead(notification.id, e)}
                                        title="Mark as read"
                                        style={{
                                            flexShrink: 0,
                                            width: '10px', height: '10px',
                                            borderRadius: '50%',
                                            background: isAiAlert ? priorityColor : '#f97316',
                                            border: 'none',
                                            cursor: 'pointer',
                                            marginTop: '4px',
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* AI Advice Modal */}
            {adviceModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.5)',
                        padding: '16px',
                    }}
                    onClick={() => setAdviceModalOpen(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: '#fff',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '700px',
                            maxHeight: '90vh',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        {/* Modal header */}
                        <div style={{
                            padding: '20px 24px',
                            background: 'linear-gradient(135deg, #dc2626, #ea580c)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '20px' }}>🤖</span>
                                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                                        AI Tactical Advice
                                    </h2>
                                </div>
                                {adviceNotification && (
                                    <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.85 }}>
                                        Based on: {adviceNotification.title}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setAdviceModalOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '18px',
                                    width: '32px',
                                    height: '32px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal body */}
                        <div style={{
                            padding: '24px',
                            overflowY: 'auto',
                            flex: 1,
                        }}>
                            {adviceLoading ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{
                                        width: '40px', height: '40px', margin: '0 auto 16px',
                                        border: '3px solid #ea580c', borderTopColor: 'transparent',
                                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                                    }} />
                                    <p style={{ color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>
                                        🔍 Analyzing detection data...
                                    </p>
                                    <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>
                                        Generating tactical advice for your team
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {/* Detection context */}
                                    {adviceNotification && (
                                        <div style={{
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            borderRadius: '10px',
                                            padding: '12px 16px',
                                            marginBottom: '20px',
                                        }}>
                                            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Detection Details
                                            </p>
                                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.6 }}>
                                                {adviceNotification.message}
                                            </p>
                                        </div>
                                    )}

                                    {/* AI advice content */}
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            color: '#374151',
                                            lineHeight: 1.7,
                                        }}
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(adviceContent) }}
                                    />
                                    {/* Emergency Route Map — always shown; uses camera GPS or defaults to Malvar centre */}
                                    <EmergencyRouteMap
                                        incidentLat={adviceCoords ? adviceCoords.lat : 14.043095}
                                        incidentLng={adviceCoords ? adviceCoords.lng : 121.156819}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #e5e7eb',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                        }}>
                            <button
                                onClick={() => setAdviceModalOpen(false)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    background: '#fff',
                                    color: '#374151',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}