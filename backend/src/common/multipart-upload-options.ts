import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

// These forms use flat text fields. Multer supports these limits before its
// type declarations expose them, so retain the extra keys in a typed extension.
type MultipartLimits = NonNullable<MulterOptions['limits']> & {
  fieldNestingDepth: number;
  fieldArrayIndexLimit: number;
};

function createUploadOptions(files: number, fields: number): MulterOptions {
  const limits: MultipartLimits = {
    fileSize: 5 * 1024 * 1024,
    files,
    fields,
    parts: files + fields,
    fieldSize: 1024 * 1024,
    fieldNameSize: 100,
    fieldNestingDepth: 0,
    fieldArrayIndexLimit: 0,
  };

  return { limits };
}

export const EMAIL_UPLOAD_OPTIONS = createUploadOptions(10, 3);
export const MEMBER_IMPORT_UPLOAD_OPTIONS = createUploadOptions(1, 1);
export const PERSONAL_INFO_UPLOAD_OPTIONS = createUploadOptions(101, 6);
