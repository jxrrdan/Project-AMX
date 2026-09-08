import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as not requiring a JWT — e.g. login, the AWP webhook, the TV board read-only URL. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
