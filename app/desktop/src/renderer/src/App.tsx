import { useMachine } from '@xstate/react';
import { useCallback, useEffect } from 'react';
import type { MergeRequest } from '@psdk-lab/core';
import { useSessions } from './components/Sessions';
import { Shell, Stepper } from './components/Shell';
import { stepNumber, workflowMachine } from './machines/workflow';
import { FailedScreen } from './screens/FailedScreen';
import { PrepareScreen } from './screens/PrepareScreen';
import { ReadyScreen } from './screens/ReadyScreen';
import { SelectScreen } from './screens/SelectScreen';

/** Choose an MR → prepare its session → launch and test, as on the mock-ups. */
export function App() {
  const [snapshot, send] = useMachine(workflowMachine);
  const { mr, steps, startedAt, failedStep, session, error } = snapshot.context;
  const state = snapshot.value;
  const { sessions, refresh } = useSessions();

  // Back on the list (after preparing, removing…): read the sessions again.
  useEffect(() => {
    if (state === 'selecting') refresh();
  }, [state, refresh]);

  useEffect(
    () =>
      window.api.onSessionStep(
        (e) =>
          e.mrIid === mr?.iid && send({ type: 'UPDATE', update: e.update }),
      ),
    [mr?.iid, send],
  );
  const select = useCallback(
    (m: MergeRequest) => send({ type: 'SELECT', mr: m }),
    [send],
  );

  return (
    <Shell>
      <Stepper current={stepNumber(state)} />
      {state === 'selecting' && (
        <SelectScreen
          selected={mr}
          onSelect={select}
          onPrepare={() => send({ type: 'PREPARE' })}
          sessions={sessions}
          onOpen={(s) => send({ type: 'OPEN', session: s })}
          onSessionsChanged={refresh}
        />
      )}
      {state === 'preparing' && mr && (
        <PrepareScreen mr={mr} steps={steps} startedAt={startedAt} />
      )}
      {state === 'failed' && mr && (
        <FailedScreen
          mr={mr}
          step={failedStep}
          error={error}
          onRetry={() => send({ type: 'PREPARE' })}
          onBack={() => send({ type: 'BACK' })}
        />
      )}
      {state === 'ready' && mr && session && (
        <ReadyScreen
          mr={mr}
          session={session}
          onBack={() => send({ type: 'BACK' })}
        />
      )}
    </Shell>
  );
}
