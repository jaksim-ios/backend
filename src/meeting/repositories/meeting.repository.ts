import { EntityRepository, Repository } from 'typeorm';
import { CreateMeetingDto } from '../dto/create-meeting.dto';
import { Meeting } from '../entities/meeting.entity';

@EntityRepository(Meeting)
export class MeetingRepository extends Repository<Meeting> {
  async getMeeting(id: number) {
    return this.createQueryBuilder('meeting')
      .addSelect('meeting.createdAt')
      .leftJoinAndSelect('meeting.users', 'user')
      .leftJoinAndSelect('meeting.category', 'category')
      .where('meeting.id = :id', { id })
      .getOne();
  }

  async getMeetingBySearch(search: string) {
    return this.createQueryBuilder('meeting')
      .where('meeting.name like :name', { name: '%' + search + '%' })
      .orWhere('meeting.descript like :descript', {
        descript: '%' + search + '%',
      })
      .getMany();
  }

  async getMeetingByCategory(categoryId: number[]) {
    return this.createQueryBuilder('meeting')
      .where('meeting.categoryId IN (:...ids)', { ids: categoryId })
      .getMany();
  }

  async createMeeting(userId: number, createMeetingDto: CreateMeetingDto) {
    const meeting = this.create({
      ...createMeetingDto,
      ownerId: userId,
    });
    return this.save(meeting);
  }
}
