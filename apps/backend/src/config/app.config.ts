import * as Joi from "joi";

export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  FRONTEND_URL: Joi.string().uri().default("http://localhost:5173"),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default("7d"),
});
