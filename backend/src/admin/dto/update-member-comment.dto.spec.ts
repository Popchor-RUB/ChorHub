import { validateSync } from 'class-validator';
import { UpdateMemberCommentDto } from './update-member-comment.dto';

describe('UpdateMemberCommentDto', () => {
  it('requires a string comment no longer than 2,000 characters', () => {
    expect(validateSync(Object.assign(new UpdateMemberCommentDto(), { comment: 'x'.repeat(2000) }))).toHaveLength(0);
    expect(validateSync(Object.assign(new UpdateMemberCommentDto(), { comment: 'x'.repeat(2001) }))).not.toHaveLength(0);
    expect(validateSync(Object.assign(new UpdateMemberCommentDto(), { comment: 1 }))).not.toHaveLength(0);
    expect(validateSync(new UpdateMemberCommentDto())).not.toHaveLength(0);
  });
});
