import Joi from 'joi';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3000;
const MIN_JWT_SECRET_LENGTH = 32;

export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_SECRET: Joi.string().min(MIN_JWT_SECRET_LENGTH).required(),
  PORT: Joi.number().integer().min(MIN_PORT).max(MAX_PORT).default(DEFAULT_PORT)
});
