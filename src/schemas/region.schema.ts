import { z } from 'zod';

// Region ids are the wilayah.id codes without dots: province 2 digits ("31"), city 4 ("3171"),
// district 6 ("317107"), sub-district 10 ("3171071001"). Up to 10 digits are accepted here. The
// service checks that each code starts with its parent's code and that the region exists.
export const REGION_ID_PATTERN = /^\d{1,10}$/;

export const regionIdRule = (label: string) =>
  z.string({ error: `${label} is required.` }).regex(REGION_ID_PATTERN, `${label} must be a numeric code.`);

export const regionIdParamsSchema = z.object({ id: regionIdRule('Id') });
