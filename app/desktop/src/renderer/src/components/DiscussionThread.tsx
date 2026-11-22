import type { Discussion, DiscussionNote } from '@psdk-lab/core';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommentInput, DiscussionList } from '../../../shared/ipc';
import { ipcMessage } from '../machines/workflow';
import { Avatar } from './Avatar';
import { Markdown } from './Markdown';

const POST_ERRORS = ['signed-out', 'forbidden', 'empty-comment', 'read-only-token'] as const;

function Note({ note, projectId }: { note: DiscussionNote; projectId?: number }) {
  const { i18n } = useTranslation();
  const date = new Date(note.createdAt).toLocaleString(i18n.resolvedLanguage, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className="note">
      <Avatar name={note.author.name} src={note.author.avatarUrl} size="sm" />
      <div className="note-main">
        <div className="note-head">
          <a href={note.author.webUrl} target="_blank" rel="noreferrer" className="note-author">
            {note.author.name}
          </a>
          <span className="muted">@{note.author.username}</span>
          <span className="muted">· {date}</span>
        </div>
        {note.onCode && (
          <div className="note-code">
            {note.onCode.path}
            {note.onCode.line !== null && `:${note.onCode.line}`}
          </div>
        )}
        <Markdown projectId={projectId}>{note.body}</Markdown>
      </div>
    </div>
  );
}

/** Text area to post with the signed-in account (Ctrl+Enter sends). */
export function Composer(props: {
  input: Omit<CommentInput, 'body'>;
  placeholder: string;
  onPosted: (list: DiscussionList) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    window.api
      .comment({ ...props.input, body })
      .then((list) => {
        setBody('');
        props.onPosted(list);
      })
      .catch((e: unknown) => setError(ipcMessage(e)))
      .finally(() => setPosting(false));
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
    if (e.key === 'Escape') props.onCancel?.();
  };
  const known = POST_ERRORS.find((c) => c === error);

  return (
    <div className="composer">
      <textarea
        value={body}
        placeholder={props.placeholder}
        rows={3}
        autoFocus={Boolean(props.onCancel)}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKey}
      />
      {error && (
        <p className="notice">
          {known ? t(`discussions.error.${known}`) : t('discussions.error.other', { message: error })}
        </p>
      )}
      <div className="composer-actions">
        <span className="small muted">{t('discussions.markdownHint')}</span>
        {props.onCancel && (
          <button type="button" className="btn btn-small" onClick={props.onCancel}>
            {t('discussions.cancel')}
          </button>
        )}
        <button type="button" className="btn btn-primary btn-small" onClick={send} disabled={posting || !body.trim()}>
          {posting ? t('discussions.posting') : t('discussions.send')}
        </button>
      </div>
    </div>
  );
}

/** A thread: its first comment, the replies, and Reply when signed in. */
export function Thread(props: {
  iid: number;
  projectId?: number;
  discussion: Discussion;
  canReply: boolean;
  onPosted: (list: DiscussionList) => void;
}) {
  const { t } = useTranslation();
  const [replying, setReplying] = useState(false);
  const { discussion: d } = props;
  const [first, ...replies] = d.notes;
  return (
    <article className={`thread${d.resolved ? ' resolved' : ''}`}>
      {d.resolvable && (
        <span className={`thread-state${d.resolved ? ' done' : ''}`}>
          {t(d.resolved ? 'discussions.resolved' : 'discussions.unresolved')}
        </span>
      )}
      <Note note={first} projectId={props.projectId} />
      {replies.length > 0 && (
        <div className="thread-replies">
          {replies.map((n) => (
            <Note key={n.id} note={n} projectId={props.projectId} />
          ))}
        </div>
      )}
      {props.canReply &&
        (replying ? (
          <Composer
            input={{ iid: props.iid, discussionId: d.id }}
            placeholder={t('discussions.replyPlaceholder')}
            onCancel={() => setReplying(false)}
            onPosted={(list) => {
              setReplying(false);
              props.onPosted(list);
            }}
          />
        ) : (
          <button type="button" className="link-btn thread-reply" onClick={() => setReplying(true)}>
            {t('discussions.reply')}
          </button>
        ))}
    </article>
  );
}
