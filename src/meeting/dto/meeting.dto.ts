import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber } from 'class-validator';

export class MeetingCategoryDto {
  @IsArray()
  @ApiProperty({
    example: [1],
    description: '모임 카테고리',
  })
  category_id: number[];
}

export class ReportUserDto {
  @IsNumber()
  @ApiProperty({
    example: 1,
    description: '상대유저',
  })
  user_id: number;

  @IsNumber()
  @ApiProperty({
    example: 0,
    description: 'type 0: 추천, 1: 신고',
  })
  type: number;
}
