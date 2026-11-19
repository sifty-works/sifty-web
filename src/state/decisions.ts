import { VacancyRow } from '../api/client.ts'

export interface SessionDecision {
  row: VacancyRow   
  from: string      
  to: string        
  idx: number       
}
