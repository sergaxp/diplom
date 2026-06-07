import { Request } from 'express';
import { JwtUser } from '../strategies/jwt.strategy';

export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}
