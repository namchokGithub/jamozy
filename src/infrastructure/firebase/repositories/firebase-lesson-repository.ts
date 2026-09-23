import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { toLesson } from '../mappers/lesson-mapper'
import type { LessonRepository } from '../../../domain/repositories/lesson-repository'
import type { Lesson } from '../../../domain/models/lesson'

export class FirebaseLessonRepository implements LessonRepository {
  async getLessonsByUnitId(unitId: string): Promise<Lesson[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'lessons'),
        where('unitId', '==', unitId),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((d) => toLesson(d.id, d.data()))
  }

  async getLessonById(lessonId: string): Promise<Lesson | null> {
    const snapshot = await getDoc(doc(db, 'lessons', lessonId))
    return snapshot.exists() ? toLesson(snapshot.id, snapshot.data()) : null
  }
}
