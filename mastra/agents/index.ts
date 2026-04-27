export { cardiology } from './cardiology'
export { oncology } from './oncology'
export { neurology } from './neurology'
export { orthopedics } from './orthopedics'
export { dermatology } from './dermatology'
export { generalPractice } from './general-practice'

import { cardiology } from './cardiology'
import { oncology } from './oncology'
import { neurology } from './neurology'
import { orthopedics } from './orthopedics'
import { dermatology } from './dermatology'
import { generalPractice } from './general-practice'

export const agentsByKey = {
  cardiology,
  oncology,
  neurology,
  orthopedics,
  dermatology,
  general_practice: generalPractice,
}
