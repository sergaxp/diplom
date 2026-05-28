'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, Bug, MessageSquare } from 'lucide-react';
import {
  feedbackApi,
  BugReport, FeatureRequest,
  BUG_STATUS_LABEL, FEATURE_STATUS_LABEL,
} from '../../lib/feedback';
import { Modal, Skeleton, EmptyState } from '../ui';
import styles from './FeedbackModal.module.scss';

interface Props {
  onClose: () => void;
}

type Tab = 'bugs' | 'features';

function formatDate(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${date} в ${time}`;
}

function BugStatusBadge({ status }: { status: BugReport['status'] }) {
  return <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>{BUG_STATUS_LABEL[status]}</span>;
}

function FeatureStatusBadge({ status }: { status: FeatureRequest['status'] }) {
  return <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>{FEATURE_STATUS_LABEL[status]}</span>;
}

export function MyFeedbackModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('bugs');

  const { data: bugs, isLoading: bugsLoading } = useQuery({
    queryKey: ['my-bug-reports'],
    queryFn: feedbackApi.getMyBugReports,
  });

  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ['my-feature-requests'],
    queryFn: feedbackApi.getMyFeatureRequests,
  });

  const renderSkeletons = () => (
    <ul className={styles.list}>
      {[1, 2, 3].map(i => <li key={i}><Skeleton width="100%" height={84} /></li>)}
    </ul>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Мои обращения"
      noPadding
    >
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bugs'}
          className={`${styles.tab} ${tab === 'bugs' ? styles.tabActive : ''}`}
          onClick={() => setTab('bugs')}
        >
          Баги {bugs && bugs.length > 0 && <span className={styles.tabCount}>{bugs.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'features'}
          className={`${styles.tab} ${tab === 'features' ? styles.tabActive : ''}`}
          onClick={() => setTab('features')}
        >
          Нововведения {features && features.length > 0 && <span className={styles.tabCount}>{features.length}</span>}
        </button>
      </div>

      <div className={styles.listWrap}>
        {tab === 'bugs' && (
          bugsLoading ? renderSkeletons() :
          !bugs?.length ? (
            <EmptyState
              size="sm"
              icon={<Bug size={48} strokeWidth={1.25} />}
              title="Вы ещё не отправляли баг-репорты"
              description="Если что-то сломалось — сообщите, мы починим."
            />
          ) : (
            <ul className={styles.list}>
              {bugs.map(b => (
                <li key={b.id} className={styles.listItem}>
                  <div className={styles.listItemTop}>
                    <span className={styles.listItemTitle}>{b.title}</span>
                    <BugStatusBadge status={b.status} />
                  </div>
                  {b.description && <p className={styles.listItemDesc}>{b.description}</p>}
                  {b.attachmentUrls?.length ? (
                    <div className={styles.listItemAttach}>
                      {b.attachmentUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className={styles.attachLink}>
                          <Paperclip size={12} /> Вложение {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <span className={styles.listItemDate}>{formatDate(b.createdAt)}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === 'features' && (
          featuresLoading ? renderSkeletons() :
          !features?.length ? (
            <EmptyState
              size="sm"
              icon={<MessageSquare size={48} strokeWidth={1.25} />}
              title="Заявок пока нет"
              description="Поделитесь идеей — что добавить или улучшить."
            />
          ) : (
            <ul className={styles.list}>
              {features.map(f => (
                <li key={f.id} className={styles.listItem}>
                  <div className={styles.listItemTop}>
                    <span className={styles.listItemTitle}>{f.title}</span>
                    <FeatureStatusBadge status={f.status} />
                  </div>
                  {f.description && <p className={styles.listItemDesc}>{f.description}</p>}
                  <span className={styles.listItemDate}>{formatDate(f.createdAt)}</span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </Modal>
  );
}
