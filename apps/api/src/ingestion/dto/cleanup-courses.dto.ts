import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class CleanupCoursesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  courseIds!: string[];
}
