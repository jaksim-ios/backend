import { HttpException } from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  Repository,
  TransactionManager,
} from 'typeorm';
import { MeetingUser } from '../entities/meeting-user.entity';

@EntityRepository(MeetingUser)
export class MeetingUserRepository extends Repository<MeetingUser> {
  async getMeetingUserById(id: number) {
    return await this.createQueryBuilder('meeting_user')
      .select(['user_id'])
      .where('meeting_user.id = :id', { id })
      .getRawOne();
  }

  async getMeetingUserByMeetingId(id: number) {
    return await this.createQueryBuilder('meeting_user')
      .leftJoinAndSelect('meeting_user.users', 'user')
      .where('meeting_user.meetingId = :id', { id })
      .getMany();
  }

  async getMeetingByUserId(userId: number) {
    return await this.createQueryBuilder('meeting_user')
      .select(['meeting.*'])
      .leftJoin('meeting_user.meetings', 'meeting')
      .where('meeting_user.userId = :userId', { userId })
      .getRawMany();
  }

  async getMeetingNonUserId(userId: number) {
    return await this.createQueryBuilder('meeting_user')
      .leftJoinAndSelect('meeting_user.meetings', 'meeting')
      .where('meeting_user.userId != :userId', { userId })
      .getMany();
  }

  async getMeetingByUserIdAndMeetingId(userId: number, meetingId: number) {
    return await this.createQueryBuilder('meeting_user')
      .andWhere('meeting_user.userId = :userId', { userId })
      .where('meeting_user.meetingId = :meetingId', { meetingId })
      .getOne();
  }

  async setUserforReport(type: number, member: MeetingUser) {
    try {
      if (type && type == 1) {
        return await this.update(member.id, { report: member.report + 1 });
      } else
        return await this.update(member.id, {
          recommand: member.recommand + 1,
        });
    } catch (error) {
      console.log(error);
      throw new HttpException(
        {
          message: '실패',
          error: error,
        },
        500,
      );
    }
  }

  async joinMeeting(
    userId: number,
    meetingId: number,
    @TransactionManager() transactionManager?: EntityManager,
  ) {
    if (!transactionManager) {
      const user = await this.getMeetingByUserIdAndMeetingId(meetingId, userId);
      if (user) return '이미 참여중인 모임입니다.';
      return this.save(
        this.create({
          meetingId,
          userId,
        }),
      );
    }
    return transactionManager.save(
      transactionManager.create(MeetingUser, {
        meetingId,
        userId,
      }),
    );
  }
}