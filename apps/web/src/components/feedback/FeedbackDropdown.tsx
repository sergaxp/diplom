'use client';

import { useRef, useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { BugReportModal } from './BugReportModal';
import { FeatureRequestModal } from './FeatureRequestModal';
import { MyFeedbackModal } from './MyFeedbackModal';
import styles from './FeedbackDropdown.module.scss';

type ActiveModal = 'bug' | 'feature' | 'my' | null;

export function FeedbackDropdown() {
  const [open, setOpen]         = useState(false);
  const [modal, setModal]       = useState<ActiveModal>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openModal = (m: ActiveModal) => {
    setOpen(false);
    setModal(m);
  };

  return (
    <>
      <div className={styles.wrap} ref={wrapRef}>
        <button
          className={styles.trigger}
          onClick={() => setOpen(v => !v)}
          aria-label="Обратная связь"
        >
          <MessageSquare size={15} />
          <span className={styles.triggerLabel}>Обратная связь</span>
        </button>

        {open && (
          <div className={styles.dropdown}>
            <button className={styles.item} onClick={() => openModal('bug')}>
              Баги
            </button>
            <button className={styles.item} onClick={() => openModal('feature')}>
              Заявки на нововведения
            </button>
            <div className={styles.divider} />
            <button className={styles.item} onClick={() => openModal('my')}>
              Мои обращения
            </button>
          </div>
        )}
      </div>

      {modal === 'bug'     && <BugReportModal      onClose={() => setModal(null)} />}
      {modal === 'feature' && <FeatureRequestModal  onClose={() => setModal(null)} />}
      {modal === 'my'      && <MyFeedbackModal      onClose={() => setModal(null)} />}
    </>
  );
}
