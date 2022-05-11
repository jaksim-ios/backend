import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MeetingUserRepository } from './repositories/meeting-user.repository';
import { MeetingRepository } from './repositories/meeting.repository';
import { RecordRepository } from 'src/record/repositories/record.repository';
import { MeetingUser } from './entities/meeting-user.entity';
import { Meeting } from './entities/meeting.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { getManager, UpdateResult } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { checkDateFormat } from 'src/common/utility/check-format';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MeetingService {
  constructor(
    @InjectRepository(MeetingRepository)
    private meetingRepository: MeetingRepository,
    @InjectRepository(MeetingUserRepository)
    private meetingUserRepository: MeetingUserRepository,
    @InjectRepository(RecordRepository)
    private recordRepository: RecordRepository,
  ) {}

  // 매인 홈
  // todo 진행률 추가
  async getMainMeeting(userId: number) {
    const myMeetings = await this.meetingUserRepository.getMeetingByUserId(
      userId,
    );
    return this.checkPassword(myMeetings);
  }

  // 추천 모임
  async recommendMeeting() {
    const recommendMeetings = await this.meetingRepository.getAll();

    for (const recommendMeeting of recommendMeetings) {
      const memberCount = await this.meetingUserRepository.count({
        meetingId: recommendMeeting.meeting_id,
      });
      recommendMeeting['memberCount'] = memberCount;
    }
  }

  // 모임 첫 화면
  async getMeeting(userId: number): Promise<Meeting[] | string> {
    const meetingInfos = await this.meetingRepository.findAll();
    const meetings = this.checkPassword(meetingInfos);

    return await this.setJoinData(userId, meetings);
  }

  // 카테고리 필터 검색
  async getMeetingByCategory(
    categoryId: number[],
    userId: number,
  ): Promise<Meeting[] | string> {
    const meetingInfos = await this.meetingRepository.getMeetingByCategory(
      categoryId,
    );
    const meetings = this.checkPassword(meetingInfos);

    return await this.setJoinData(userId, meetings);
  }

  // 검색어로 검색 (모임명,한줄소개)
  async getMeetingBySearch(
    search: string,
    userId: number,
  ): Promise<Meeting[] | string> {
    const meetingInfos = await this.meetingRepository.getMeetingBySearch(
      search,
    );
    const meetings = this.checkPassword(meetingInfos);

    return await this.setJoinData(userId, meetings);
  }

  async setJoinData(userId: number, meetingInfos: Meeting[]) {
    const myMeeting = await this.meetingUserRepository.getMeetingByUserId(
      userId,
    );

    for (const meetingInfo of meetingInfos) {
      meetingInfo['memberCount'] = await this.meetingUserRepository.count({
        meetingId: meetingInfo.id,
      });
      meetingInfo['join'] = myMeeting.some(
        (meeting) => meetingInfo.id == meeting.id,
      );
    }
    return meetingInfos;
  }

  // 모임 홈
  // 멤버 프로필사진, 닉네임, 달성률, 추천, 신고
  async getMeetingHome(userId: number, id: number) {
    // user validation
    const user =
      await this.meetingUserRepository.getMeetingByUserIdAndMeetingId(
        id,
        userId,
      );
    if (!user) throw new NotFoundException('모임에 참여하지 않은 유저입니다.');

    const meeting = await this.meetingRepository.getMeetingById(id);

    // 모임 주기 계산
    const date = await this.calMeetingDate(
      meeting.meeting_created_at,
      meeting.meeting_cycle,
      meeting.meeting_round,
    );

    const meetingUsers =
      await this.meetingUserRepository.getMeetingUserByMeetingId(id);
    // 멤버별 달성률 및 순위
    const memberRate = await this.calMemberRate(
      meeting.meeting_target_amount,
      meetingUsers,
      date.startDate,
      date.endDate,
    );

    // 모임 전체 달성률
    const meetingRate = await this.calMeetingRate(
      meeting.meeting_id,
      meeting.meeting_target_amount,
      date.startDate,
      date.endDate,
    );

    return {
      meeting,
      memberRate,
      meetingDate: date,
    };
  }

  // 모임 주기 계산
  async calMeetingDate(createdAt: Date, cycle: number, round: number) {
    const startDate = new Date(createdAt);
    const endDate = new Date(createdAt);

    if (cycle == 0) {
      startDate.setDate(startDate.getDate() + 1 * (round - 1));
      endDate.setDate(endDate.getDate() + 1 * round);
    } else if (cycle == 1) {
      startDate.setDate(startDate.getDate() + 7 * (round - 1));
      endDate.setDate(endDate.getDate() + 7 * round);
    } else {
      startDate.setDate(startDate.getDate() + 30 * (round - 1));
      endDate.setDate(endDate.getDate() + 30 * round);
    }

    return {
      startDate: checkDateFormat(startDate),
      endDate: checkDateFormat(endDate),
    };
  }

  // 멤버별 달성률 계산
  async calMemberRate(
    targetAmount: number,
    meetingUsers: MeetingUser[],
    startDate: string,
    endDate: string,
  ) {
    // eslint-disable-next-line prefer-const
    let memberRate: { userId: number; rate: number }[] = [];
    for (const meetingUser of meetingUsers) {
      const rateData =
        await this.recordRepository.getMeetingValueSumByMeetingUserId(
          meetingUser.id,
          startDate,
          endDate,
        );

      memberRate.push({
        userId: meetingUser.userId,
        rate: rateData ? (rateData.sum_value / targetAmount) * 100 : 0,
      });
    }

    return memberRate;
  }

  // 모임 달성률 계산
  async calMeetingRate(
    meetinfId: number,
    targetAmount: number,
    startDate: string,
    endDate: string,
  ) {
    return;
  }

  // 추천 신고 API
  // 0: recommand, 1: report
  async setUserforReport(
    meetingId: number,
    userId: number,
    type: number,
  ): Promise<false | UpdateResult> {
    return await this.meetingUserRepository.setUserforReport(
      meetingId,
      userId,
      type,
    );
  }

  // 모임 개설
  async createMeeting(userId: number, createMeetingDto: CreateMeetingDto) {
    await getManager()
      .transaction(async (transactionManager) => {
        const meeting = await this.meetingRepository.createMeeting(
          transactionManager,
          userId,
          createMeetingDto,
        );
        await this.meetingUserRepository.joinMeeting(
          userId,
          meeting.id,
          transactionManager,
        );
      })
      .catch((error) => {
        throw new HttpException(
          {
            error: error,
            message: '모임 개설 실패',
          },
          500,
        );
      });
  }

  // 모임 참여
  async joinMeeting(
    userId: number,
    meetingId: number,
  ): Promise<MeetingUser | string> {
    return await this.meetingUserRepository.joinMeeting(userId, meetingId);
  }

  // 모임 password 유무 확인
  checkPassword(meetings: Meeting[]) {
    for (const meeting of meetings) {
      if (meeting.password) meeting['password'] = 'true';
      else meeting['password'] = 'false';
    }
    return meetings;
  }

  // password validation
  async validatePassword(meetingId: number, password: string) {
    const meeting = await this.meetingRepository.findOne({
      id: meetingId,
    });

    if (meeting.password)
      return await bcrypt.compare(password, meeting.password);

    throw new NotFoundException('비밀번호가 존재하지 않는 모임입니다.');
  }
}
