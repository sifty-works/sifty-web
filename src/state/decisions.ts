import { VacancyRow } from '../api/client.ts'

/** A decision made in this session that is kept on screen in the Inbox list until reload. */
export interface SessionDecision {
  row: VacancyRow   // the original row displayed in the list
  from: string      // stage before the decision (always 'inbox' for decisions from Inbox)
  to: string        // stage after the decision: 'shortlist' | 'dismissed'
  idx: number       // index in the display list when the decision was made
}
