import { useTranslation } from 'react-i18next';
import { mrBody } from '../mr-text';
import { Markdown } from './Markdown';

/** The whole MR description, the template checklist folded at the end. */
export function MrDescription(props: { description: string; projectId?: number }) {
  const { description, projectId } = props;
  const { t } = useTranslation();
  const { intro, body } = mrBody(description);
  return (
    <div className="mr-description">
      {body ? (
        <Markdown projectId={projectId}>{body}</Markdown>
      ) : (
        <p className="muted small">{t('select.noDescription')}</p>
      )}
      {intro && (
        <details className="mr-intro">
          <summary className="muted">{t('select.templateIntro')}</summary>
          <Markdown projectId={projectId}>{intro}</Markdown>
        </details>
      )}
    </div>
  );
}
