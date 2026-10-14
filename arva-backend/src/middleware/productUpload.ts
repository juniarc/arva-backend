import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { ValidationError } from '../lib/errors.js';
import { MAX_IMAGE_BYTES, MAX_PRODUCT_IMAGES } from '../lib/image-file.js';

// Reads a product upload: up to 5 files in the field "images" and one text field "data" (the
// product as JSON). Files stay in memory until the service has checked everything, so nothing is
// written to disk for a request that is rejected. Limits keep a bad request small.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_PRODUCT_IMAGES,
    fields: 1,
    fieldSize: 20 * 1024,
    parts: MAX_PRODUCT_IMAGES + 1,
  },
}).array('images', MAX_PRODUCT_IMAGES);

const MESSAGES: Record<string, { field: string; message: string }> = {
  LIMIT_FILE_SIZE: { field: 'images', message: 'Each photo must be 2 MB or smaller.' },
  LIMIT_FILE_COUNT: { field: 'images', message: `Add up to ${MAX_PRODUCT_IMAGES} photos.` },
  LIMIT_UNEXPECTED_FILE: { field: 'images', message: `Add up to ${MAX_PRODUCT_IMAGES} photos.` },
  LIMIT_FIELD_VALUE: { field: 'data', message: 'The product details are too long.' },
};

// multer errors become the usual 400 with field messages.
export const productUpload: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  upload(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    // A multer limit, or a request that is not valid multipart: both are the client's mistake.
    const code = error instanceof multer.MulterError ? error.code : '';
    const known = MESSAGES[code] ?? { field: 'body', message: 'The upload could not be read.' };
    next(new ValidationError('Please fix the highlighted fields.', { [known.field]: known.message }));
  });
};
