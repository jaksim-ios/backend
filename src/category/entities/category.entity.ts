import { ApiProperty } from '@nestjs/swagger';
import { CoreEntity } from 'src/common/entity/core.entity';
import { Meeting } from 'src/meeting/entities/meeting.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity({ name: 'category' })
export class Category extends CoreEntity {
  @ApiProperty({
    example: '공부',
    description: '모임 카테고리',
  })
  @Column('varchar', {
    name: 'name',
    length: 200,
    default: '공부',
    comment: '모임 카테고리',
  })
  name: string;

  @OneToMany(() => Meeting, (tbMeeting) => tbMeeting.category)
  meetings: Meeting[];
}
