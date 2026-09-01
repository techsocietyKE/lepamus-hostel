import { z } from 'zod';
import { toCents } from './money.js';

export function normalisePhone(input) {
  if (!input) return null;
  const digits = String(input).replace(/[^0-9]/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('254')) n = n.slice(3);
  else if (n.startsWith('0')) n = n.slice(1);
  if (n.length !== 9) return null;
  if (!/^[17]/.test(n)) return null; 
  return `254${n}`;
}

export function displayPhone(stored) {
  if (!stored || stored.length !== 12) return stored ?? '';
  return `0${stored.slice(3, 6)} ${stored.slice(6, 9)} ${stored.slice(9)}`;
}

const phone = z.string().trim().transform((v, ctx) => {
  const n = normalisePhone(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid Kenyan mobile number' });
    return z.NEVER;
  }
  return n;
});

const optionalPhone = z.string().trim().optional().transform((v, ctx) => {
  if (!v) return null;
  const n = normalisePhone(v);
  if (!n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid Kenyan mobile number' });
    return z.NEVER;
  }
  return n;
});

const money = z.string().trim().transform((v, ctx) => {
  const cents = toCents(v);
  if (cents === null || cents < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an amount, for example 2500' });
    return z.NEVER;
  }
  return cents;
});

const signedMoney = z.string().trim().optional().transform((v, ctx) => {
  if (v === undefined || v === '') return 0;
  const cents = toCents(v);
  if (cents === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an amount, for example 2500' });
    return z.NEVER;
  }
  return cents;
});

const optionalText = z.string().trim().max(2000).optional().transform((v) => v || null);

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

// NEW: Handle File objects coming from FormData
const imageFiles = z.array(z.any()).optional().transform((files, ctx) => {
  if (!files || files.length === 0) return [];
  // Filter out empty file objects (which happen when the input is untouched)
  const validFiles = files.filter(f => f && typeof f === 'object' && f.size > 0);
  
  if (validFiles.length > 12) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Twelve photographs is plenty' });
    return z.NEVER;
  }
  return validFiles;
});

export const blockSchema = z.object({
  name: z.string().trim().min(1, 'Give the block a name').max(30).transform((v) => v.toUpperCase()),
  description: optionalText,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const roomSchema = z.object({
  blockId: z.string().uuid('Choose a block'),
  code: z.string().trim().min(1, 'Give the room a number').max(20)
    .regex(/^[A-Za-z0-9\-/]+$/, 'Use letters and numbers, for example A1')
    .transform((v) => v.toUpperCase()),
  capacity: z.coerce.number().int().min(1, 'A room needs at least one bed').max(12, 'That is a lot of beds   check the number'),
  monthlyRent: money,
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  description: optionalText,
});

export const roomRangeSchema = z.object({
  blockId: z.string().uuid('Choose a block'),
  prefix: z.string().trim().min(1, 'Give the room numbers a prefix, for example A').max(10).transform((v) => v.toUpperCase()),
  from: z.coerce.number().int().min(0).max(999),
  to: z.coerce.number().int().min(0).max(999),
  capacity: z.coerce.number().int().min(1).max(12),
  monthlyRent: money,
  gender: z.enum(['MALE', 'FEMALE', 'ANY']),
  description: optionalText,
}).refine((v) => v.to >= v.from, {
  message: 'The last number must not be smaller than the first',
  path: ['to'],
}).refine((v) => v.to - v.from < 200, {
  message: 'That would create more than 200 rooms at once',
  path: ['to'],
});

export const studentSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the student\u2019s name').max(120),
  phone,
  email: z.string().trim().email('Enter a valid email, or leave it blank')
    .optional().or(z.literal('')).transform((v) => v || null),
  gender: z.enum(['MALE', 'FEMALE']),
  idNumber: z.string().trim().max(30).optional().transform((v) => v || null),
  institution: optionalText,
  course: optionalText,
  nextOfKinName: z.string().trim().max(120).optional().transform((v) => v || null),
  nextOfKinPhone: optionalPhone,
  admittedAt: z.string().trim().optional().transform((v) => v || null),
  openingBalance: signedMoney,
});

export const cashPaymentSchema = z.object({
  studentId: z.string().uuid(),
  amount: money.refine((cents) => cents > 0, 'Enter an amount greater than zero'),
  paidAt: z.string().trim().optional().transform((v) => v || null),
  note: optionalText,
});

const transactionCode = z.string().trim().toUpperCase()
  .regex(/^[A-Z0-9]{10}$/, 'An M-Pesa code is 10 letters and numbers, like TGH4X8K2LM');

export const tillPaymentSchema = z.object({
  studentId: z.string().uuid('Choose a student'),
  amount: money.refine((cents) => cents > 0, 'Enter an amount greater than zero'),
  transactionCode,
  paidAt: z.string().trim().min(1, 'When was it paid?'),
  payerPhone: optionalPhone,
  note: optionalText,
});

export const submitPaymentSchema = z.object({
  amount: money.refine((cents) => cents > 0, 'Enter the amount you paid'),
  transactionCode,
  paidAt: z.string().trim().min(1, 'When did you pay?'),
  payerPhone: optionalPhone,
});

export const approveSchema = z.object({
  paymentId: z.string().uuid(),
  amount: money.refine((cents) => cents > 0, 'Enter an amount greater than zero'),
});

export const rejectSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().trim().min(3, 'Give a reason   the student sees it').max(300),
});

export const reliefSchema = z.object({
  studentId: z.string().uuid(),
  kind: z.enum(['PLACEMENT', 'NEGOTIATED', 'HARDSHIP', 'OTHER']),
  startYear: z.coerce.number().int().min(2020).max(2100),
  startMonth: z.coerce.number().int().min(1).max(12),
  endYear: z.coerce.number().int().min(2020).max(2100),
  endMonth: z.coerce.number().int().min(1).max(12),
  payPercent: z.coerce.number().int()
    .min(0, 'Between 0 and 100').max(100, 'A student cannot pay more than the full share'),
  reason: z.string().trim().min(3, 'Say why   this is the record of the decision').max(300),
}).refine(
  (v) => (v.endYear * 12 + v.endMonth) >= (v.startYear * 12 + v.startMonth),
  { message: 'The last month cannot be before the first', path: ['endMonth'] },
).refine(
  (v) => (v.endYear * 12 + v.endMonth) - (v.startYear * 12 + v.startMonth) < 24,
  { message: 'That is more than two years   check the dates', path: ['endMonth'] },
);

export const chargeSchema = z.object({
  periodId: z.string().uuid('Choose a month'),
  target: z.enum(['STUDENT', 'ROOM']),
  studentId: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  roomId: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  type: z.enum(['DAMAGE', 'KEY', 'CLEANING', 'OTHER']),
  description: z.string().trim().min(3, 'Say what the charge is for').max(300),
  amount: money.refine((cents) => cents > 0, 'Enter an amount greater than zero'),
}).refine(
  (v) => (v.target === 'STUDENT' ? Boolean(v.studentId) : Boolean(v.roomId)),
  { message: 'Choose who the charge is for', path: ['target'] },
);

export const adjustInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  discount: money,
  reason: z.string().trim().min(3, 'Say why   it goes on the record').max(300),
});

export const rulesSchema = z.object({
  title: z.string().trim().min(3, 'Give the rules a title').max(160),
  content: z.string().trim().min(50, 'The rules look too short   check the text').max(40000),
});

export const bookingSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your name').max(120),
  phone,
  email: z.string().trim().email('Enter a valid email, or leave it blank')
    .optional().or(z.literal('')).transform((v) => v || null),
  gender: z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'Choose one' }) }),
  institution: z.string().trim().max(160).optional().transform((v) => v || null),
  categoryId: z.string().uuid().optional().or(z.literal('')).transform((v) => v || null),
  desiredMoveIn: z.string().trim().optional().transform((v) => v || null),
  message: z.string().trim().max(1000).optional().transform((v) => v || null),
});

export const approveBookingSchema = z.object({
  bookingId: z.string().uuid(),
  roomId: z.string().uuid('Choose a room to give them'),
  startDate: z.string().trim().min(1, 'Choose a start date'),
});

export const decideBookingSchema = z.object({
  bookingId: z.string().uuid(),
  status: z.enum(['REJECTED', 'WAITLISTED']),
  note: z.string().trim().max(300).optional().transform((v) => v || null),
});

export const periodSchema = z.object({
  year: z.coerce.number().int().min(2020, 'Check the year').max(2100, 'Check the year'),
  month: z.coerce.number().int().min(1).max(12),
});

export const allocateSchema = z.object({
  studentId: z.string().uuid(),
  roomId: z.string().uuid('Choose a room'),
  startDate: z.string().trim().min(1, 'Choose a start date'),
  override: z.coerce.boolean().optional().default(false),
  overrideReason: optionalText,
});

export const categorySchema = z.object({
  id: z.string().uuid(),
  description: optionalText,
  images: imageFiles, // USING THE NEW VALIDATOR
  maxShownPublicly: z.coerce.number().int()
    .min(1, 'Show at least one').max(50, 'That would overwhelm the page'),
  isPublic: checkbox,
});

export const settingsSchema = z.object({
  hostelName: z.string().trim().min(1, 'The hostel needs a name').max(120),
  tillNumber: z.string().trim().regex(/^[0-9]{5,9}$/, 'A Till number is 5 to 9 digits'),
  tillBusinessName: z.string().trim().min(1, 'Enter the name M-Pesa shows').max(120).transform((v) => v.toUpperCase()),
  contactPhone: optionalPhone,
  contactEmail: z.string().trim().email('Enter a valid email, or leave it blank')
    .optional().or(z.literal('')).transform((v) => v || null),
  location: optionalText,
  rentDueDay: z.coerce.number().int().min(1, 'Pick a day from 1 to 28').max(28, 'Pick a day from 1 to 28'),
  graceDays: z.coerce.number().int().min(0).max(31),
  bookingHoldDays: z.coerce.number().int().min(1, 'Hold a booking for at least a day').max(30),
  cleaningDelayDays: z.coerce.number().int().min(0).max(30),
  staleClaimDays: z.coerce.number().int().min(1, 'At least a day').max(30),
  smsEnabled: checkbox,
  emailEnabled: checkbox,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your phone number or email'),
  password: z.string().min(1, 'Enter your password'),
});

export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}