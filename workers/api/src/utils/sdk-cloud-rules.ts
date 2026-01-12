import { ValidationError } from './error-handler';

export type RulesValue =
  | { var: 'auth.openid' }
  | string
  | number
  | boolean
  | null;

export type RulesCond = {
  field: string;
  op: '==';
  value: RulesValue;
};

export type RulesExpr =
  | { allOf: RulesCond[] }
  | { anyOf: Array<{ allOf: RulesCond[] }> };

export type SecurityRulesV0 = {
  version: 0;
  read: RulesExpr;
  write: RulesExpr;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseRulesValue(raw: unknown): RulesValue {
  if (raw === null) return null;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (isPlainObject(raw) && raw.var === 'auth.openid') return { var: 'auth.openid' };
  throw new ValidationError('invalid_rules_value');
}

function parseCond(raw: unknown): RulesCond {
  if (!isPlainObject(raw)) throw new ValidationError('invalid_rules_condition');
  const field = typeof raw.field === 'string' ? raw.field.trim() : '';
  if (!field) throw new ValidationError('invalid_rules_condition');
  const op = raw.op;
  if (op !== '==') throw new ValidationError('invalid_rules_condition');
  return { field, op, value: parseRulesValue(raw.value) };
}

function parseAllOf(raw: unknown): { allOf: RulesCond[] } {
  if (!isPlainObject(raw)) throw new ValidationError('invalid_rules_expr');
  const list = raw.allOf;
  if (!Array.isArray(list)) throw new ValidationError('invalid_rules_expr');
  return { allOf: list.map(parseCond) };
}

function parseExpr(raw: unknown): RulesExpr {
  if (!isPlainObject(raw)) throw new ValidationError('invalid_rules_expr');
  if (Array.isArray(raw.allOf)) {
    return parseAllOf(raw);
  }
  if (Array.isArray(raw.anyOf)) {
    return { anyOf: raw.anyOf.map(parseAllOf) };
  }
  throw new ValidationError('invalid_rules_expr');
}

export function parseSecurityRulesV0(raw: unknown): SecurityRulesV0 {
  if (!isPlainObject(raw)) throw new ValidationError('invalid_security_rules');
  if (raw.version !== 0) throw new ValidationError('invalid_security_rules_version');
  const read = parseExpr(raw.read);
  const write = parseExpr(raw.write);
  return { version: 0, read, write };
}

export function rulesBranches(expr: RulesExpr): Array<{ allOf: RulesCond[] }> {
  if ('anyOf' in expr) return expr.anyOf;
  return [expr];
}
