import { DecisionRequest, VacancyRow } from '../api/client.ts'

export interface SessionDecision {
  row: VacancyRow   
  from: DecisionRequest['from']
  to: DecisionRequest['to']
  idx: number       
}

export interface ReturnedRow {
  row: VacancyRow
  idx: number
}
